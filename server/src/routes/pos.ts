import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import PO from '../models/PO';
import SOW from '../models/SOW';
import CustomerPlant from '../models/CustomerPlant';
import Customer from '../models/Customer';
import User, { FORECAST_ROLES } from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { uploadPO } from '../middleware/upload';
import { recomputeSignedState } from '../services/poCascade';

const router = Router();
router.use(protect);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isForecastUser(role?: string) {
  return FORECAST_ROLES.includes(role as any);
}

/** Parse incoming allocations into clean {sowId, amount} pairs (drops zero/blank rows). */
function parseAllocations(raw: unknown): { sowId: mongoose.Types.ObjectId; amount: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: any) => a && a.sowId && Number(a.amount) > 0)
    .map((a: any) => ({
      sowId: new mongoose.Types.ObjectId(String(a.sowId)),
      amount: Number(a.amount),
    }));
}

const POPULATE_OPTIONS = [
  { path: 'customerId', select: 'name code displayName' },
  { path: 'plantId',    select: 'plantName plantCode currency' },
  { path: 'ownerId',    select: 'name email' },
  { path: 'linkedSOWIds', select: 'sowId title totalValue signedValue status' },
];

// ─── List ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('status').optional().isIn(['open', 'partial', 'closed', 'cancelled']),
    query('customerId').optional().isMongoId(),
    query('sowId').optional().isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, customerId, sowId, page = 1, limit = 50 } = req.query;
      const filter: Record<string, unknown> = { isActive: true };
      if (status) filter.status = status;
      if (customerId) filter.customerId = customerId;
      if (sowId) filter['allocations.sowId'] = sowId;

      // Non-admin forecast users only see POs for their assigned sites.
      if (req.user && isForecastUser(req.user.role) && req.user.role !== 'finance_admin') {
        const user = await User.findById(req.user._id).lean();
        const allowedSites = user?.assignedSites || [];
        filter.plantId = { $in: allowedSites };
      }

      const total = await PO.countDocuments(filter);
      const pos = await PO.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .populate(POPULATE_OPTIONS);

      res.json({ success: true, data: pos, pagination: { total, page: Number(page), limit: Number(limit) } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Get single ───────────────────────────────────────────────────────────────

router.get(
  '/:id',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const po = await PO.findById(req.params.id).populate(POPULATE_OPTIONS);
      if (!po || !po.isActive) {
        res.status(404).json({ success: false, message: 'PO not found' });
        return;
      }
      res.json({ success: true, data: po });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Create ───────────────────────────────────────────────────────────────────

router.post(
  '/',
  authorize(...FORECAST_ROLES),
  [
    body('poNumber').trim().notEmpty().withMessage('PO number is required'),
    body('customerId').isMongoId().withMessage('Valid customer ID required'),
    body('plantId').optional().isMongoId(),
    body('poDate').isISO8601().withMessage('Valid PO date is required'),
    body('poValue').isFloat({ min: 0 }).withMessage('PO value must be ≥ 0'),
    body('allocations').isArray({ min: 1 }).withMessage('Link the PO to at least one SOW'),
    body('allocations.*.sowId').isMongoId().withMessage('Valid SOW ID required'),
    body('allocations.*.amount').isFloat({ min: 0 }).withMessage('Allocation amount must be ≥ 0'),
    body('notes').optional().isString(),
    body('milestones').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { poNumber, customerId, plantId, poDate, poValue, allocations, notes, milestones } = req.body;

      const parsedAllocations = parseAllocations(allocations);
      if (parsedAllocations.length === 0) {
        res.status(400).json({ success: false, message: 'At least one SOW allocation with a positive amount is required' });
        return;
      }

      // Currency: prefer the site, fall back to the customer default.
      let currency: string | undefined;
      if (plantId) {
        const plant = await CustomerPlant.findById(plantId).lean();
        currency = plant?.currency;
      }
      if (!currency) {
        const customer = await Customer.findById(customerId).lean();
        currency = customer?.defaultCurrency;
      }
      if (!currency) {
        res.status(400).json({ success: false, message: 'Could not determine currency for this PO' });
        return;
      }

      const linkedSOWIds = parsedAllocations.map((a) => a.sowId);

      const po = await PO.create({
        poNumber,
        customerId,
        plantId: plantId || undefined,
        linkedSOWIds,
        allocations: parsedAllocations,
        poDate: new Date(poDate),
        poValue: Number(poValue),
        currency,
        status: 'open',
        ownerId: req.user?._id,
        documents: [],
        amendments: [],
        milestones,
        notes,
        isActive: true,
      });

      // Cascade signed amounts into the linked SOWs and their forecasts.
      await recomputeSignedState(linkedSOWIds, req.user?._id);

      const populated = await PO.findById(po._id).populate(POPULATE_OPTIONS);
      res.status(201).json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Update ───────────────────────────────────────────────────────────────────

router.put(
  '/:id',
  authorize(...FORECAST_ROLES),
  [
    body('poNumber').optional().trim().notEmpty(),
    body('poDate').optional().isISO8601(),
    body('poValue').optional().isFloat({ min: 0 }),
    body('status').optional().isIn(['open', 'partial', 'closed', 'cancelled']),
    body('allocations').optional().isArray({ min: 1 }),
    body('allocations.*.sowId').optional().isMongoId(),
    body('allocations.*.amount').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
    body('milestones').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const po = await PO.findById(req.params.id);
      if (!po || !po.isActive) {
        res.status(404).json({ success: false, message: 'PO not found' });
        return;
      }

      if (req.user && req.user.role !== 'finance_admin' && String(po.ownerId) !== String(req.user._id)) {
        res.status(403).json({ success: false, message: 'You can only edit your own POs' });
        return;
      }

      const { poNumber, poDate, poValue, status, allocations, notes, milestones } = req.body;

      // SOWs touched before the edit must also be recomputed (they may lose coverage).
      const previousSOWIds = po.allocations.map((a) => a.sowId);

      if (poNumber !== undefined) po.poNumber = poNumber;
      if (poDate !== undefined) po.poDate = new Date(poDate);
      if (poValue !== undefined) po.poValue = Number(poValue);
      if (status !== undefined) po.status = status;
      if (notes !== undefined) po.notes = notes;
      if (milestones !== undefined) po.milestones = milestones;

      let allSOWIds = previousSOWIds;
      if (allocations !== undefined) {
        const parsedAllocations = parseAllocations(allocations);
        po.allocations = parsedAllocations as any;
        po.linkedSOWIds = parsedAllocations.map((a) => a.sowId);
        allSOWIds = [...previousSOWIds, ...parsedAllocations.map((a) => a.sowId)];
      }

      await po.save();
      await recomputeSignedState(allSOWIds, req.user?._id);

      const populated = await PO.findById(po._id).populate(POPULATE_OPTIONS);
      res.json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Upload documents (one or more) ─────────────────────────────────────────────

router.post(
  '/:id/documents',
  authorize(...FORECAST_ROLES),
  (req, res, next) => {
    uploadPO(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        res.status(400).json({ success: false, message: 'No files uploaded' });
        return;
      }

      const po = await PO.findById(req.params.id);
      if (!po || !po.isActive) {
        res.status(404).json({ success: false, message: 'PO not found' });
        return;
      }

      for (const file of files) {
        po.documents.push({
          originalName: file.originalname,
          storedName: file.filename,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy: req.user?._id as mongoose.Types.ObjectId,
          uploadedAt: new Date(),
          remarks: req.body.remarks || undefined,
        } as any);
      }

      await po.save();
      res.status(201).json({
        success: true,
        data: po.documents,
        message: `${files.length} document(s) uploaded`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Deactivate ─────────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  authorize(...FORECAST_ROLES),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const po = await PO.findById(req.params.id);
      if (!po || !po.isActive) {
        res.status(404).json({ success: false, message: 'PO not found' });
        return;
      }

      if (req.user && req.user.role !== 'finance_admin' && String(po.ownerId) !== String(req.user._id)) {
        res.status(403).json({ success: false, message: 'You can only delete your own POs' });
        return;
      }

      const affectedSOWIds = po.allocations.map((a) => a.sowId);
      po.isActive = false;
      await po.save();

      // Recompute the SOWs/forecasts that just lost this PO's coverage.
      await recomputeSignedState(affectedSOWIds, req.user?._id);

      res.json({ success: true, message: 'PO removed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
