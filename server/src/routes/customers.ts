import { Router, Response, NextFunction } from 'express';
import { body, validationResult, query } from 'express-validator';
import Customer from '../models/Customer';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

/**
 * GET /api/customers
 * List all customers with optional search and filter
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, isActive, page = 1, limit = 50 } = req.query;

    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ name: 1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      data: customers,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/customers/:id
 * Get a single customer
 */
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await Customer.findById(req.params.id).populate('createdBy', 'name email');
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/customers
 * Create a new customer (finance_admin only)
 */
router.post(
  '/',
  authorize('finance_admin'),
  [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('code').trim().notEmpty().withMessage('Customer code is required'),
    body('defaultCurrency')
      .isIn(['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'])
      .withMessage('Invalid currency'),
    body('creditPeriodDays').isInt({ min: 0 }).withMessage('Credit period must be a non-negative integer'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const existing = await Customer.findOne({ code: req.body.code.toUpperCase() });
      if (existing) {
        res.status(409).json({ success: false, message: 'Customer code already in use' });
        return;
      }

      const customer = await Customer.create({
        ...req.body,
        createdBy: req.user?._id,
      });

      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/customers/:id
 * Update a customer (finance_admin only)
 */
router.put(
  '/:id',
  authorize('finance_admin'),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Prevent changing the code after creation
      const { code, createdBy, ...updates } = req.body;

      const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });

      if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }

      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
