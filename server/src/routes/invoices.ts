import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import fs from 'fs';
import Invoice from '../models/Invoice';
import PO from '../models/PO';
import Customer from '../models/Customer';
import CustomerPlant from '../models/CustomerPlant';
import User, { FORECAST_ROLES } from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { generateInvoiceNumber } from '../utils/idGenerator';
import { generateInvoicePdf } from '../services/invoicePdf';
import { applyInvoiceDrawdown, reverseInvoiceDrawdown } from '../services/invoiceCascade';

const router = Router();
router.use(protect);

function isForecastUser(role?: string) {
  return FORECAST_ROLES.includes(role as any);
}

const POPULATE_OPTIONS = [
  { path: 'customerId', select: 'name code displayName defaultCurrency' },
  { path: 'plantId',    select: 'plantName plantCode billingAddress' },
  { path: 'lineItems.poId', select: 'poNumber poValue effectivePOValue invoicedValue remainingValue status' },
  { path: 'request.requestedBy', select: 'name email' },
  { path: 'issuedBy',   select: 'name email' },
];

// ─── List ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'issued', 'partial', 'paid', 'cancelled', 'overdue']),
    query('customerId').optional().isMongoId(),
    query('poId').optional().isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, customerId, poId, page = 1, limit = 50 } = req.query;
      const filter: Record<string, unknown> = { isActive: true };
      if (status) filter.status = status;
      if (customerId) filter.customerId = customerId;
      if (poId) filter.poIds = poId;

      if (req.user && isForecastUser(req.user.role) && req.user.role !== 'finance_admin') {
        const user = await User.findById(req.user._id).lean();
        const allowedSites = user?.assignedSites || [];
        filter.plantId = { $in: allowedSites };
      }

      const total = await Invoice.countDocuments(filter);
      const invoices = await Invoice.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .populate(POPULATE_OPTIONS);

      res.json({ success: true, data: invoices, pagination: { total, page: Number(page), limit: Number(limit) } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Get single ───────────────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate(POPULATE_OPTIONS);
    if (!invoice || !invoice.isActive) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// ─── Create (draft) ─────────────────────────────────────────────────────────────

router.post(
  '/',
  authorize(...FORECAST_ROLES),
  [
    body('customerId').isMongoId().withMessage('Valid customer ID required'),
    body('plantId').optional().isMongoId(),
    body('invoiceDate').isISO8601().withMessage('Valid invoice date required'),
    body('payByDate').isISO8601().withMessage('Valid pay-by date required'),
    body('lineItems').isArray({ min: 1 }).withMessage('Bill at least one PO'),
    body('lineItems.*.poId').isMongoId().withMessage('Valid PO ID required'),
    body('lineItems.*.amount').isFloat({ min: 0 }).withMessage('Line amount must be ≥ 0'),
    body('lineItems.*.description').optional().isString(),
    body('taxAmount').optional().isFloat({ min: 0 }),
    body('taxDescription').optional().isString(),
    body('description').optional().isString(),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { customerId, plantId, invoiceDate, payByDate, lineItems, taxAmount, taxDescription, description, notes } = req.body;

      // Load and validate the POs: all must exist, be active, and belong to this customer.
      const poIds = (lineItems as any[]).map((l) => l.poId);
      const pos = await PO.find({ _id: { $in: poIds }, isActive: true });
      if (pos.length !== poIds.length) {
        res.status(400).json({ success: false, message: 'One or more POs were not found' });
        return;
      }
      const poById = new Map(pos.map((p) => [String(p._id), p]));

      const wrongCustomer = pos.find((p) => String(p.customerId) !== String(customerId));
      if (wrongCustomer) {
        res.status(400).json({ success: false, message: 'All POs must belong to the selected customer' });
        return;
      }

      const currencies = new Set(pos.map((p) => p.currency));
      if (currencies.size > 1) {
        res.status(400).json({ success: false, message: 'All POs on one invoice must share the same currency' });
        return;
      }
      const currency = pos[0].currency;

      const builtLineItems = (lineItems as any[]).map((l) => {
        const po = poById.get(String(l.poId))!;
        return {
          poId: po._id,
          poNumber: po.poNumber,
          description: (l.description && String(l.description).trim()) || po.milestones || `PO ${po.poNumber}`,
          amount: Number(l.amount),
        };
      });

      const invoiceValue = builtLineItems.reduce((s, l) => s + l.amount, 0);

      const invoiceNumber = await generateInvoiceNumber();
      const invoice = await Invoice.create({
        invoiceNumber,
        customerId,
        plantId: plantId || pos[0].plantId || undefined,
        lineItems: builtLineItems,
        poIds: builtLineItems.map((l) => l.poId),
        invoiceDate: new Date(invoiceDate),
        payByDate: new Date(payByDate),
        invoiceValue,
        currency,
        status: 'draft',
        description,
        taxAmount: taxAmount ? Number(taxAmount) : 0,
        taxDescription: taxDescription || 'NA',
        request: {
          requestedBy: req.user?._id,
          requestedAt: new Date(),
          requestedAmount: invoiceValue,
          description: description || `Invoice for ${builtLineItems.length} PO(s)`,
        },
        notes,
        isActive: true,
      });

      const populated = await Invoice.findById(invoice._id).populate(POPULATE_OPTIONS);
      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Update (draft only) ─────────────────────────────────────────────────────────

router.put(
  '/:id',
  authorize(...FORECAST_ROLES),
  [
    body('invoiceDate').optional().isISO8601(),
    body('payByDate').optional().isISO8601(),
    body('lineItems').optional().isArray({ min: 1 }),
    body('lineItems.*.poId').optional().isMongoId(),
    body('lineItems.*.amount').optional().isFloat({ min: 0 }),
    body('taxAmount').optional().isFloat({ min: 0 }),
    body('taxDescription').optional().isString(),
    body('description').optional().isString(),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const invoice = await Invoice.findById(req.params.id);
      if (!invoice || !invoice.isActive) {
        res.status(404).json({ success: false, message: 'Invoice not found' });
        return;
      }
      if (invoice.status !== 'draft') {
        res.status(409).json({ success: false, message: 'Only draft invoices can be edited' });
        return;
      }
      if (req.user && req.user.role !== 'finance_admin' && String(invoice.request.requestedBy) !== String(req.user._id)) {
        res.status(403).json({ success: false, message: 'You can only edit your own invoices' });
        return;
      }

      const { invoiceDate, payByDate, lineItems, taxAmount, taxDescription, description, notes } = req.body;

      if (invoiceDate !== undefined) invoice.invoiceDate = new Date(invoiceDate);
      if (payByDate !== undefined) invoice.payByDate = new Date(payByDate);
      if (taxAmount !== undefined) invoice.taxAmount = Number(taxAmount);
      if (taxDescription !== undefined) invoice.taxDescription = taxDescription;
      if (description !== undefined) invoice.description = description;
      if (notes !== undefined) invoice.notes = notes;

      if (lineItems !== undefined) {
        const poIds = (lineItems as any[]).map((l) => l.poId);
        const pos = await PO.find({ _id: { $in: poIds }, isActive: true });
        if (pos.length !== poIds.length) {
          res.status(400).json({ success: false, message: 'One or more POs were not found' });
          return;
        }
        const poById = new Map(pos.map((p) => [String(p._id), p]));
        if (pos.some((p) => String(p.customerId) !== String(invoice.customerId))) {
          res.status(400).json({ success: false, message: 'All POs must belong to the invoice customer' });
          return;
        }
        if (new Set(pos.map((p) => p.currency)).size > 1) {
          res.status(400).json({ success: false, message: 'All POs on one invoice must share the same currency' });
          return;
        }

        const builtLineItems = (lineItems as any[]).map((l) => {
          const po = poById.get(String(l.poId))!;
          return {
            poId: po._id,
            poNumber: po.poNumber,
            description: (l.description && String(l.description).trim()) || po.milestones || `PO ${po.poNumber}`,
            amount: Number(l.amount),
          };
        });
        invoice.lineItems = builtLineItems as any;
        invoice.poIds = builtLineItems.map((l) => l.poId) as any;
        invoice.invoiceValue = builtLineItems.reduce((s, l) => s + l.amount, 0);
        invoice.request.requestedAmount = invoice.invoiceValue;
      }

      await invoice.save();
      const populated = await Invoice.findById(invoice._id).populate(POPULATE_OPTIONS);
      res.json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Issue: generate PDF + draw down POs ─────────────────────────────────────────

router.post(
  '/:id/issue',
  authorize(...FORECAST_ROLES),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice || !invoice.isActive) {
        res.status(404).json({ success: false, message: 'Invoice not found' });
        return;
      }
      if (invoice.status !== 'draft') {
        res.status(409).json({ success: false, message: 'Only draft invoices can be issued' });
        return;
      }

      const customer = await Customer.findById(invoice.customerId).lean();
      let customerAddress: string | undefined;
      if (invoice.plantId) {
        const plant = await CustomerPlant.findById(invoice.plantId).lean();
        customerAddress = plant?.billingAddress;
      }

      const pdfPath = await generateInvoicePdf({
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        payByDate: invoice.payByDate,
        currency: invoice.currency,
        customerName: customer?.name || 'Customer',
        customerAddress,
        lineItems: invoice.lineItems.map((l) => ({
          poNumber: l.poNumber,
          description: l.description,
          amount: l.amount,
        })),
        taxAmount: invoice.taxAmount,
        taxDescription: invoice.taxDescription,
      });

      invoice.pdfPath = pdfPath;
      invoice.status = 'issued';
      invoice.issuedBy = req.user?._id as mongoose.Types.ObjectId;
      invoice.issuedAt = new Date();
      await invoice.save();

      // Draw down the billed POs (invoiced/remaining + status).
      await applyInvoiceDrawdown(invoice.lineItems);

      const populated = await Invoice.findById(invoice._id).populate(POPULATE_OPTIONS);
      res.json({ success: true, data: populated, message: 'Invoice issued' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Cancel ───────────────────────────────────────────────────────────────────

router.post(
  '/:id/cancel',
  authorize(...FORECAST_ROLES),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice || !invoice.isActive) {
        res.status(404).json({ success: false, message: 'Invoice not found' });
        return;
      }
      if (invoice.status === 'cancelled') {
        res.status(409).json({ success: false, message: 'Invoice is already cancelled' });
        return;
      }
      if (invoice.status === 'paid') {
        res.status(409).json({ success: false, message: 'A paid invoice cannot be cancelled' });
        return;
      }

      // Reverse the PO drawdown only if it was actually applied (i.e. issued).
      if (['issued', 'partial', 'overdue'].includes(invoice.status)) {
        await reverseInvoiceDrawdown(invoice.lineItems);
      }

      invoice.status = 'cancelled';
      invoice.cancelledBy = req.user?._id as mongoose.Types.ObjectId;
      invoice.cancelledAt = new Date();
      invoice.cancellationRemarks = req.body.remarks || undefined;
      await invoice.save();

      res.json({ success: true, message: 'Invoice cancelled' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Download PDF ────────────────────────────────────────────────────────────────

router.get('/:id/pdf', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || !invoice.isActive) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }
    if (!invoice.pdfPath || !fs.existsSync(invoice.pdfPath)) {
      res.status(404).json({ success: false, message: 'Invoice PDF not generated yet — issue the invoice first' });
      return;
    }
    res.download(invoice.pdfPath, `${invoice.invoiceNumber}.pdf`);
  } catch (error) {
    next(error);
  }
});

// ─── Deactivate (draft only) ─────────────────────────────────────────────────────

router.delete(
  '/:id',
  authorize(...FORECAST_ROLES),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const invoice = await Invoice.findById(req.params.id);
      if (!invoice || !invoice.isActive) {
        res.status(404).json({ success: false, message: 'Invoice not found' });
        return;
      }
      if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
        res.status(409).json({ success: false, message: 'Only draft or cancelled invoices can be removed' });
        return;
      }
      invoice.isActive = false;
      await invoice.save();
      res.json({ success: true, message: 'Invoice removed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
