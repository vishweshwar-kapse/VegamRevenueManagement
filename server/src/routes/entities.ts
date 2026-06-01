import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import Entity from '../models/Entity';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

// ─── List ─────────────────────────────────────────────────────────────────────

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const entities = await Entity.find({ isActive: true }).sort({ isDefault: -1, name: 1 });
    res.json({ success: true, data: entities });
  } catch (error) {
    next(error);
  }
});

// ─── Get single ───────────────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity || !entity.isActive) {
      res.status(404).json({ success: false, message: 'Entity not found' });
      return;
    }
    res.json({ success: true, data: entity });
  } catch (error) {
    next(error);
  }
});

// ─── Shared validation ────────────────────────────────────────────────────────

const createValidation = [
  body('entityCode')
    .trim().notEmpty().withMessage('Entity code is required')
    .customSanitizer((v: string) => v?.toUpperCase()),
  body('name').trim().notEmpty().withMessage('Entity name is required'),
  body('defaultCurrency')
    .isIn(['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'])
    .withMessage('Valid currency is required'),
];

const updateValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
  body('defaultCurrency')
    .optional()
    .isIn(['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'])
    .withMessage('Invalid currency'),
];

// ─── Create ───────────────────────────────────────────────────────────────────

router.post(
  '/',
  authorize('finance_admin'),
  createValidation,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const existing = await Entity.findOne({ entityCode: req.body.entityCode });
      if (existing) {
        res.status(409).json({ success: false, message: 'Entity code already in use' });
        return;
      }

      // Enforce single default
      if (req.body.isDefault) {
        await Entity.updateMany({ isDefault: true }, { isDefault: false });
      }

      const entity = await Entity.create({
        ...req.body,
        createdBy: req.user?._id,
      });

      res.status(201).json({ success: true, data: entity });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Update ───────────────────────────────────────────────────────────────────

router.put(
  '/:id',
  authorize('finance_admin'),
  updateValidation,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      // Enforce single default
      if (req.body.isDefault) {
        await Entity.updateMany(
          { isDefault: true, _id: { $ne: req.params.id } },
          { isDefault: false }
        );
      }

      // Prevent overwriting code or audit fields
      const { entityCode, createdBy, ...updates } = req.body;

      const entity = await Entity.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!entity || !entity.isActive) {
        res.status(404).json({ success: false, message: 'Entity not found' });
        return;
      }

      res.json({ success: true, data: entity });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Deactivate ───────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  authorize('finance_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entity = await Entity.findById(req.params.id);
      if (!entity || !entity.isActive) {
        res.status(404).json({ success: false, message: 'Entity not found' });
        return;
      }
      entity.isActive = false;
      await entity.save();
      res.json({ success: true, message: 'Entity removed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
