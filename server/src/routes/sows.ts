import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import SOW from '../models/SOW';
import Forecast from '../models/Forecast';
import CustomerPlant from '../models/CustomerPlant';
import Customer from '../models/Customer';
import User, { FORECAST_ROLES } from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { uploadSOW } from '../middleware/upload';
import { generateForecastId, generateSOWId } from '../utils/idGenerator';
import { recomputeSignedState } from '../services/poCascade';

const router = Router();
router.use(protect);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isForecastUser(role?: string) {
  return FORECAST_ROLES.includes(role as any);
}

// Indian fiscal year: April = Q1 start
function getFYFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  return `FY${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
}

function getQuarterFromDate(date: Date): 'q1' | 'q2' | 'q3' | 'q4' {
  const month = date.getMonth() + 1;
  if (month >= 4 && month <= 6) return 'q1';
  if (month >= 7 && month <= 9) return 'q2';
  if (month >= 10 && month <= 12) return 'q3';
  return 'q4';
}

function buildDistributionsFromMilestones(milestones: { amount: number; deliveryDate: Date }[]) {
  const fyMap: Record<string, { q1: number; q2: number; q3: number; q4: number }> = {};
  for (const m of milestones) {
    const fy = getFYFromDate(m.deliveryDate);
    if (!fyMap[fy]) fyMap[fy] = { q1: 0, q2: 0, q3: 0, q4: 0 };
    fyMap[fy][getQuarterFromDate(m.deliveryDate)] += m.amount;
  }
  return Object.entries(fyMap).map(([fy, q]) => ({
    fy,
    q1: q.q1, q2: q.q2, q3: q.q3, q4: q.q4,
    total: q.q1 + q.q2 + q.q3 + q.q4,
  }));
}

const POPULATE_OPTIONS = [
  { path: 'entityId',   select: 'name entityCode' },
  { path: 'customerId', select: 'name code displayName' },
  { path: 'plantId',    select: 'plantName plantCode currency' },
  { path: 'ownerId',    select: 'name email' },
  { path: 'forecastId', select: 'forecastId fy totalValue projection status' },
];

// ─── List ─────────────────────────────────────────────────────────────────────

router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'submitted', 'linked', 'partially_accepted', 'accepted', 'closed', 'archived']),
    query('customerId').optional().isMongoId(),
    query('plantId').optional().isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, customerId, plantId, page = 1, limit = 50 } = req.query;
      const filter: Record<string, unknown> = { isActive: true };
      if (status) filter.status = status;
      if (customerId) filter.customerId = customerId;
      if (plantId) filter.plantId = plantId;

      if (req.user && isForecastUser(req.user.role) && req.user.role !== 'finance_admin') {
        const user = await User.findById(req.user._id).lean();
        const allowedSites = user?.assignedSites || [];
        filter.plantId = plantId
          ? { $in: allowedSites.map(String).includes(String(plantId)) ? [plantId] : [] }
          : { $in: allowedSites };
      }

      const total = await SOW.countDocuments(filter);
      const sows = await SOW.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .populate(POPULATE_OPTIONS);

      res.json({ success: true, data: sows, pagination: { total, page: Number(page), limit: Number(limit) } });
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
      const sow = await SOW.findById(req.params.id).populate(POPULATE_OPTIONS);
      if (!sow || !sow.isActive) {
        res.status(404).json({ success: false, message: 'SOW not found' });
        return;
      }
      res.json({ success: true, data: sow });
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
    body('customerId').isMongoId().withMessage('Valid customer ID required'),
    body('plantId').isMongoId().withMessage('Valid plant/site ID required'),
    body('title').trim().notEmpty().withMessage('SOW title is required'),
    body('milestones').isArray({ min: 1 }).withMessage('At least one milestone is required'),
    body('milestones.*.description').trim().notEmpty().withMessage('Milestone description is required'),
    body('milestones.*.amount').isFloat({ min: 0 }).withMessage('Milestone amount must be ≥ 0'),
    body('milestones.*.deliveryDate').isISO8601().withMessage('Milestone delivery date must be a valid date'),
    body('forecastId').optional().isMongoId(),
    body('autoCreateForecast').optional().isBoolean(),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { entityId, customerId, plantId, title, description, milestones, notes, forecastId, autoCreateForecast } = req.body;

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

      const parsedMilestones = (milestones as any[]).map((m: any) => ({
        description: String(m.description),
        amount: Number(m.amount),
        deliveryDate: new Date(m.deliveryDate),
      }));
      const totalValue = parsedMilestones.reduce((s: number, m: any) => s + m.amount, 0);
      const distributions = buildDistributionsFromMilestones(parsedMilestones);
      const primaryFY = distributions.length > 0 ? distributions[0].fy : getFYFromDate(new Date());

      // Pre-generate the SOW ObjectId so the forecast can reference it in a single write.
      const sowObjectId = new mongoose.Types.ObjectId();
      let linkedForecastObjectId: mongoose.Types.ObjectId | undefined;

      if (forecastId) {
        const alreadyClaimed = await SOW.findOne({ forecastId: new mongoose.Types.ObjectId(forecastId), isActive: true }).lean();
        if (alreadyClaimed) {
          res.status(409).json({ success: false, message: 'This forecast is already linked to another SOW. Each forecast can only be linked to one SOW.' });
          return;
        }

        linkedForecastObjectId = new mongoose.Types.ObjectId(forecastId);
        // Update distributions AND link the SOW in one atomic operation.
        await Forecast.findByIdAndUpdate(forecastId, {
          $set: { distributions: distributions as any, totalValue },
          $addToSet: { linkedSOWIds: sowObjectId },
        });
      } else if (autoCreateForecast) {
        const newForecastId = await generateForecastId();
        const newForecast = await Forecast.create({
          forecastId: newForecastId,
          entityId: entityId || undefined,
          customerId,
          plantId,
          description: title,
          fy: primaryFY,
          totalValue,
          currency,
          status: 'projected',
          ownerId: req.user?._id,
          distributions,
          projection: totalValue,
          signedValue: 0,
          projectedValue: totalValue,
          notes,
          // Link the pre-generated SOW id — no second write needed.
          linkedSOWIds: [sowObjectId],
          history: [{ action: 'created', changedBy: req.user?._id, changedAt: new Date(), newValue: totalValue }],
        });
        linkedForecastObjectId = newForecast._id;
      }

      const sowId = await generateSOWId();
      const sow = await SOW.create({
        _id: sowObjectId,
        sowId,
        entityId: entityId || undefined,
        customerId,
        plantId,
        forecastId: linkedForecastObjectId,
        title,
        description,
        totalValue,
        currency,
        milestones: parsedMilestones,
        status: 'draft',
        ownerId: req.user?._id,
        documents: [],
        currentVersion: 1,
        versions: [],
        notes,
        isActive: true,
      });

      const populated = await SOW.findById(sow._id).populate(POPULATE_OPTIONS);
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
    body('title').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('status').optional().isIn(['draft', 'submitted', 'linked', 'partially_accepted', 'accepted', 'closed', 'archived']),
    body('milestones').optional().isArray({ min: 1 }),
    body('forecastId').optional().isMongoId(),
    body('updateForecast').optional().isBoolean(),
    body('notes').optional().isString(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const sow = await SOW.findById(req.params.id);
      if (!sow || !sow.isActive) {
        res.status(404).json({ success: false, message: 'SOW not found' });
        return;
      }

      if (req.user && req.user.role !== 'finance_admin') {
        if (String(sow.ownerId) !== String(req.user._id)) {
          res.status(403).json({ success: false, message: 'You can only edit your own SOWs' });
          return;
        }
      }

      const { title, description, status, milestones, notes, forecastId, updateForecast } = req.body;

      if (title !== undefined) sow.title = title;
      if (description !== undefined) sow.description = description;
      if (status !== undefined) sow.status = status;
      if (notes !== undefined) sow.notes = notes;

      if (forecastId !== undefined) {
        if (forecastId) {
          const alreadyClaimed = await SOW.findOne({
            forecastId: new mongoose.Types.ObjectId(forecastId),
            isActive: true,
            _id: { $ne: sow._id },
          }).lean();
          if (alreadyClaimed) {
            res.status(409).json({ success: false, message: 'This forecast is already linked to another SOW. Each forecast can only be linked to one SOW.' });
            return;
          }
        }
        sow.forecastId = forecastId ? new mongoose.Types.ObjectId(forecastId) : undefined;
      }

      if (milestones !== undefined) {
        const parsedMilestones = (milestones as any[]).map((m: any) => ({
          description: String(m.description),
          amount: Number(m.amount),
          deliveryDate: new Date(m.deliveryDate),
        }));
        sow.milestones = parsedMilestones as any;
        sow.totalValue = parsedMilestones.reduce((s: number, m: any) => s + m.amount, 0);

        const linkedId = forecastId || sow.forecastId;
        if (linkedId && updateForecast) {
          const updatedDistributions = buildDistributionsFromMilestones(parsedMilestones);
          await Forecast.findByIdAndUpdate(linkedId, {
            $set: { distributions: updatedDistributions as any, totalValue: sow.totalValue },
          });
        }
      }

      await sow.save();

      // If the milestone totals changed on a SOW that already has PO coverage, the
      // signed/pending split and accepted status may now be stale — recompute the
      // cascade. Gated on linkedPOIds so a PO-less SOW keeps its manual workflow status.
      if (milestones !== undefined && sow.linkedPOIds && sow.linkedPOIds.length > 0) {
        await recomputeSignedState([sow._id as mongoose.Types.ObjectId], req.user?._id);
      }

      const populated = await SOW.findById(sow._id).populate(POPULATE_OPTIONS);
      res.json({ success: true, data: populated });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Upload document to existing SOW ─────────────────────────────────────────

router.post(
  '/:id/document',
  authorize(...FORECAST_ROLES),
  (req, res, next) => {
    uploadSOW(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      const sow = await SOW.findById(req.params.id);
      if (!sow || !sow.isActive) {
        res.status(404).json({ success: false, message: 'SOW not found' });
        return;
      }

      const nextVersion = (sow.currentVersion || 1) + 1;
      sow.documents.push({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        version: nextVersion,
        isActive: true,
        uploadedBy: req.user?._id as mongoose.Types.ObjectId,
        uploadedAt: new Date(),
        remarks: req.body.remarks || undefined,
      } as any);
      sow.currentVersion = nextVersion;
      sow.versions.push({
        versionNumber: nextVersion,
        description: req.body.description || `Version ${nextVersion}`,
        uploadedBy: req.user?._id as mongoose.Types.ObjectId,
        uploadedAt: new Date(),
      });

      await sow.save();
      res.status(201).json({
        success: true,
        data: sow.documents,
        message: `Document version ${nextVersion} uploaded`,
      });
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
      const sow = await SOW.findById(req.params.id);
      if (!sow || !sow.isActive) {
        res.status(404).json({ success: false, message: 'SOW not found' });
        return;
      }

      if (req.user && req.user.role !== 'finance_admin') {
        if (String(sow.ownerId) !== String(req.user._id)) {
          res.status(403).json({ success: false, message: 'You can only delete your own SOWs' });
          return;
        }
      }

      sow.isActive = false;
      await sow.save();
      res.json({ success: true, message: 'SOW removed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
