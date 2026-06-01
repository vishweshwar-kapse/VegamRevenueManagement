import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import CustomerPlant from '../models/CustomerPlant';
import Customer from '../models/Customer';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

/**
 * GET /api/customer-plants?customerId=xxx
 * List all plants for a customer
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, isActive, region, country } = req.query;

    const filter: Record<string, unknown> = {};
    if (customerId) filter.customerId = customerId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (region) filter.region = region;
    if (country) filter.country = country;

    const plants = await CustomerPlant.find(filter)
      .sort({ isDefault: -1, plantName: 1 })
      .populate('customerId', 'name code')
      .populate('createdBy', 'name email');

    res.json({ success: true, data: plants });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customer-plants/:id
 * Get a single plant
 */
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plant = await CustomerPlant.findById(req.params.id)
      .populate('customerId', 'name code defaultCurrency defaultCreditPeriodDays')
      .populate('createdBy', 'name email');

    if (!plant) {
      res.status(404).json({ success: false, message: 'Plant not found' });
      return;
    }
    res.json({ success: true, data: plant });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customer-plants
 * Create a new plant (finance_admin only)
 */
router.post(
  '/',
  authorize('finance_admin'),
  [
    body('plantCode').trim().notEmpty().withMessage('Plant code is required'),
    body('plantName').trim().notEmpty().withMessage('Plant name is required'),
    body('customerId').notEmpty().withMessage('Customer is required'),
    body('country').trim().notEmpty().withMessage('Country is required'),
    body('timezone').notEmpty().withMessage('Timezone is required'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const customer = await Customer.findById(req.body.customerId);
      if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }

      const existing = await CustomerPlant.findOne({ plantCode: req.body.plantCode.toUpperCase() });
      if (existing) {
        res.status(409).json({ success: false, message: 'Plant code already in use' });
        return;
      }

      // If this is the first plant for the customer, make it the default
      const plantCount = await CustomerPlant.countDocuments({ customerId: req.body.customerId });
      const isDefault = req.body.isDefault ?? plantCount === 0;

      // If marking as default, unset any existing default for this customer
      if (isDefault) {
        await CustomerPlant.updateMany(
          { customerId: req.body.customerId, isDefault: true },
          { isDefault: false }
        );
      }

      const plant = await CustomerPlant.create({
        ...req.body,
        isDefault,
        createdBy: req.user?._id,
      });

      res.status(201).json({ success: true, data: plant });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/customer-plants/:id
 * Update a plant (finance_admin only)
 */
router.put(
  '/:id',
  authorize('finance_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { plantCode, customerId, createdBy, ...updates } = req.body;

      // If marking as default, unset the current default for this customer
      if (updates.isDefault === true) {
        const plant = await CustomerPlant.findById(req.params.id);
        if (plant) {
          await CustomerPlant.updateMany(
            { customerId: plant.customerId, isDefault: true, _id: { $ne: plant._id } },
            { isDefault: false }
          );
        }
      }

      const plant = await CustomerPlant.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!plant) {
        res.status(404).json({ success: false, message: 'Plant not found' });
        return;
      }

      res.json({ success: true, data: plant });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/customer-plants/:id
 * Soft-delete a plant (finance_admin only)
 */
router.delete(
  '/:id',
  authorize('finance_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plant = await CustomerPlant.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!plant) {
        res.status(404).json({ success: false, message: 'Plant not found' });
        return;
      }

      res.json({ success: true, message: 'Plant deactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
