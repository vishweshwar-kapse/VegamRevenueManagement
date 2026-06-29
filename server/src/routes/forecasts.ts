import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Forecast from '../models/Forecast';
import SOW from '../models/SOW';
import CustomerPlant from '../models/CustomerPlant';
import Customer from '../models/Customer';
import User, { FORECAST_ROLES } from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { generateForecastId } from '../utils/idGenerator';

const router = Router();
router.use(protect);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isForecastUser(role?: string) {
  return FORECAST_ROLES.includes(role as any);
}

// ─── Summary (dashboard) ──────────────────────────────────────────────────────

router.get(
  '/summary',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fy = (req.query.fy as string) || currentFY();
      const filter: Record<string, unknown> = { isActive: true, fy };

      // Forecast users see only their assigned sites
      if (req.user && isForecastUser(req.user.role) && req.user.role !== 'finance_admin') {
        const user = await User.findById(req.user._id).lean();
        filter.plantId = { $in: user?.assignedSites || [] };
      }

      const forecasts = await Forecast.find(filter).lean();

      const totalForecastValue = forecasts.reduce((s, f) => s + f.totalValue, 0);
      const signedValue = forecasts.filter((f) => f.status === 'signed').reduce((s, f) => s + f.totalValue, 0);
      const projectedValue = forecasts.filter((f) => f.status === 'projected').reduce((s, f) => s + f.totalValue, 0);
      const conversionRate = totalForecastValue > 0 ? Math.round((signedValue / totalForecastValue) * 1000) / 10 : 0;

      // Quarterly roll-up for the FY
      const qTotals = { q1: 0, q2: 0, q3: 0, q4: 0 };
      for (const f of forecasts) {
        const dist = f.distributions.find((d) => d.fy === fy);
        if (dist) {
          qTotals.q1 += dist.q1;
          qTotals.q2 += dist.q2;
          qTotals.q3 += dist.q3;
          qTotals.q4 += dist.q4;
        }
      }

      res.json({
        success: true,
        data: {
          fy,
          totalForecastValue,
          signedValue,
          projectedValue,
          conversionRate,
          forecastCount: forecasts.length,
          quarterly: qTotals,
          // Invoice/payment KPIs will be populated once those modules are built
          revenueInvoiced: 0,
          revenueRealized: 0,
          outstandingReceivables: 0,
          overdueReceivables: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── List ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('fy').optional().isString(),
    query('status').optional().isIn(['projected', 'signed', 'closed']),
    query('customerId').optional().isMongoId(),
    query('plantId').optional().isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('unlinked').optional().isBoolean(),
    query('currentSowId').optional().isMongoId(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fy, status, customerId, plantId, page = 1, limit = 50, unlinked, currentSowId } = req.query;

      const filter: Record<string, unknown> = { isActive: true };
      if (fy) filter.fy = fy;
      if (status) filter.status = status;
      if (customerId) filter.customerId = customerId;
      if (plantId) filter.plantId = plantId;

      // Restrict forecast users to their assigned sites
      if (req.user && isForecastUser(req.user.role) && req.user.role !== 'finance_admin') {
        const user = await User.findById(req.user._id).lean();
        const allowedSites = user?.assignedSites || [];
        filter.plantId = plantId
          ? { $in: allowedSites.map(String).includes(String(plantId)) ? [plantId] : [] }
          : { $in: allowedSites };
      }

      // Exclude forecasts already claimed by another SOW (1-to-1 rule).
      // If currentSowId is supplied the caller is editing that SOW, so its own
      // linked forecast is still available.
      if (unlinked === 'true') {
        const sowFilter: Record<string, unknown> = { isActive: true, forecastId: { $exists: true, $ne: null } };
        if (currentSowId) {
          sowFilter._id = { $ne: new mongoose.Types.ObjectId(currentSowId as string) };
        }
        const linkedSows = await SOW.find(sowFilter).select('forecastId').lean();
        const usedIds = linkedSows.map((s) => s.forecastId).filter(Boolean);
        filter._id = { $nin: usedIds };
      }

      const total = await Forecast.countDocuments(filter);
      const forecasts = await Forecast.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .populate('entityId', 'name entityCode')
        .populate('customerId', 'name code displayName')
        .populate('plantId', 'plantName plantCode currency')
        .populate('ownerId', 'name email');

      res.json({
        success: true,
        data: forecasts,
        pagination: { total, page: Number(page), limit: Number(limit) },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Get single ───────────────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const forecast = await Forecast.findById(req.params.id)
      .populate('entityId', 'name entityCode defaultCurrency')
      .populate('customerId', 'name code displayName defaultCurrency')
      .populate('plantId', 'plantName plantCode currency')
      .populate('ownerId', 'name email');

    if (!forecast || !forecast.isActive) {
      res.status(404).json({ success: false, message: 'Forecast not found' });
      return;
    }

    // Forecast users can only see forecasts for their assigned sites
    if (req.user && isForecastUser(req.user.role) && req.user.role !== 'finance_admin') {
      const user = await User.findById(req.user._id).lean();
      const allowed = (user?.assignedSites || []).map(String);
      if (!allowed.includes(String(forecast.plantId._id ?? forecast.plantId))) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }
    }

    res.json({ success: true, data: forecast });
  } catch (error) {
    next(error);
  }
});

// ─── Create ───────────────────────────────────────────────────────────────────

router.post(
  '/',
  authorize(...FORECAST_ROLES),
  [
    body('customerId').isMongoId().withMessage('Valid customer ID required'),
    body('plantId').isMongoId().withMessage('Valid plant/site ID required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('fy').trim().notEmpty().withMessage('Financial year is required'),
    body('status').optional().isIn(['projected', 'signed', 'closed']),
    body('distributions').isArray({ min: 1 }).withMessage('At least one distribution entry is required'),
    body('distributions.*.fy').trim().notEmpty().withMessage('Distribution FY is required'),
    body('distributions.*.q1').isFloat({ min: 0 }).withMessage('Q1 must be ≥ 0'),
    body('distributions.*.q2').isFloat({ min: 0 }).withMessage('Q2 must be ≥ 0'),
    body('distributions.*.q3').isFloat({ min: 0 }).withMessage('Q3 must be ≥ 0'),
    body('distributions.*.q4').isFloat({ min: 0 }).withMessage('Q4 must be ≥ 0'),
    body('projection').optional().isFloat({ min: 0 }).withMessage('Projection must be ≥ 0'),
    body('signedValue').optional().isFloat({ min: 0 }).withMessage('Signed value must be ≥ 0'),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { entityId, customerId, plantId, description, fy, status, distributions, notes, projection, signedValue } = req.body;

      // Verify site access for non-admins
      if (req.user && req.user.role !== 'finance_admin') {
        const user = await User.findById(req.user._id).lean();
        const allowed = (user?.assignedSites || []).map(String);
        if (!allowed.includes(String(plantId))) {
          res.status(403).json({ success: false, message: 'You do not have access to this site' });
          return;
        }
      }

      // Derive currency: site override → customer default
      const plant = await CustomerPlant.findById(plantId).lean();
      if (!plant) {
        res.status(404).json({ success: false, message: 'Site not found' });
        return;
      }
      let currency = plant.currency;
      if (!currency) {
        const customer = await Customer.findById(customerId).lean();
        currency = customer?.defaultCurrency;
      }
      if (!currency) {
        res.status(400).json({ success: false, message: 'Could not determine currency for this site' });
        return;
      }

      // Compute totals per distribution and grand total
      const enrichedDistributions = (distributions as any[]).map((d: any) => ({
        fy: d.fy,
        q1: Number(d.q1) || 0,
        q2: Number(d.q2) || 0,
        q3: Number(d.q3) || 0,
        q4: Number(d.q4) || 0,
        total: (Number(d.q1) || 0) + (Number(d.q2) || 0) + (Number(d.q3) || 0) + (Number(d.q4) || 0),
      }));
      const totalValue = enrichedDistributions.reduce((s: number, d: any) => s + d.total, 0);

      const forecastId = await generateForecastId();
      const forecast = await Forecast.create({
        forecastId,
        entityId: entityId || undefined,
        customerId,
        plantId,
        description,
        fy,
        totalValue,
        currency,
        status: status || 'projected',
        ownerId: req.user?._id,
        distributions: enrichedDistributions,
        projection: projection !== undefined ? Number(projection) : totalValue,
        signedValue: (status === 'signed' && signedValue !== undefined) ? Number(signedValue) : 0,
        projectedValue: status !== 'signed' ? totalValue : 0,
        notes,
        history: [{
          action: 'created',
          changedBy: req.user?._id,
          changedAt: new Date(),
          newValue: totalValue,
        }],
      });

      res.status(201).json({ success: true, data: forecast });
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
    body('description').optional().trim().notEmpty(),
    body('status').optional().isIn(['projected', 'signed', 'closed']),
    body('distributions').optional().isArray({ min: 1 }),
    body('distributions.*.fy').optional().trim().notEmpty(),
    body('distributions.*.q1').optional().isFloat({ min: 0 }),
    body('distributions.*.q2').optional().isFloat({ min: 0 }),
    body('distributions.*.q3').optional().isFloat({ min: 0 }),
    body('distributions.*.q4').optional().isFloat({ min: 0 }),
    body('projection').optional().isFloat({ min: 0 }).withMessage('Projection must be ≥ 0'),
    body('signedValue').optional().isFloat({ min: 0 }).withMessage('Signed value must be ≥ 0'),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const forecast = await Forecast.findById(req.params.id);
      if (!forecast || !forecast.isActive) {
        res.status(404).json({ success: false, message: 'Forecast not found' });
        return;
      }

      // Non-admin can only edit their own forecasts
      if (req.user && req.user.role !== 'finance_admin') {
        if (String(forecast.ownerId) !== String(req.user._id)) {
          res.status(403).json({ success: false, message: 'You can only edit your own forecasts' });
          return;
        }
      }

      const previousValue = forecast.totalValue;
      const { description, status, distributions, notes, projection, signedValue } = req.body;

      if (description !== undefined) forecast.description = description;
      if (notes !== undefined) forecast.notes = notes;
      if (projection !== undefined) forecast.projection = Number(projection);
      if (status !== undefined) forecast.status = status;

      if (distributions !== undefined) {
        const enriched = (distributions as any[]).map((d: any) => ({
          fy: d.fy,
          q1: Number(d.q1) || 0,
          q2: Number(d.q2) || 0,
          q3: Number(d.q3) || 0,
          q4: Number(d.q4) || 0,
          total: (Number(d.q1) || 0) + (Number(d.q2) || 0) + (Number(d.q3) || 0) + (Number(d.q4) || 0),
        }));
        forecast.distributions = enriched;
        forecast.totalValue = enriched.reduce((s: number, d: any) => s + d.total, 0);
      }

      // signedValue is owned by the PO → SOW → Forecast cascade (see services/poCascade.ts).
      // Only overwrite it when the request explicitly provides one (manual override / signed
      // forecast created via the form); otherwise leave the cascade-computed value intact so a
      // routine edit (description, status, distributions) does not wipe PO-confirmed amounts.
      if (signedValue !== undefined) {
        forecast.signedValue = Number(signedValue);
      }
      // projectedValue is always the remaining unconfirmed portion of the current total.
      forecast.projectedValue = Math.max(forecast.totalValue - forecast.signedValue, 0);

      forecast.history.push({
        action: 'updated',
        changedBy: req.user?._id as mongoose.Types.ObjectId,
        changedAt: new Date(),
        previousValue,
        newValue: forecast.totalValue,
      });

      await forecast.save();
      res.json({ success: true, data: forecast });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Deactivate ───────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  authorize(...FORECAST_ROLES),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const forecast = await Forecast.findById(req.params.id);
      if (!forecast || !forecast.isActive) {
        res.status(404).json({ success: false, message: 'Forecast not found' });
        return;
      }

      if (req.user && req.user.role !== 'finance_admin') {
        if (String(forecast.ownerId) !== String(req.user._id)) {
          res.status(403).json({ success: false, message: 'You can only delete your own forecasts' });
          return;
        }
      }

      forecast.isActive = false;
      await forecast.save();
      res.json({ success: true, message: 'Forecast removed' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  // Indian fiscal year: April–March
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
}

export default router;
