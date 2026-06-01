import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// All user management routes require finance_admin role
router.use(protect, authorize('finance_admin'));

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find()
      .sort({ name: 1 })
      .select('-password')
      .populate('assignedSites', 'plantCode plantName customerId')
      .populate('assignedCustomers', 'code name displayName');
    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role')
      .isIn(['finance_admin', 'management', 'account_manager', 'project_manager', 'am_pm', 'read_only_pm'])
      .withMessage('Invalid role'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { name, email, password, role } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        res.status(409).json({ success: false, message: 'Email already in use' });
        return;
      }

      const user = await User.create({ name, email, password, role });

      res.status(201).json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/users/:id
 * Update a user
 */
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowedUpdates = ['name', 'role', 'isActive'];
    const updates: Record<string, unknown> = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:id/assignments
 * Assign customers and sites to a forecast user
 */
router.put(
  '/:id/assignments',
  [
    body('assignedSites').isArray().withMessage('assignedSites must be an array'),
    body('assignedCustomers').isArray().withMessage('assignedCustomers must be an array'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        {
          assignedSites: req.body.assignedSites,
          assignedCustomers: req.body.assignedCustomers,
        },
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/users/:id/reset-password
 * Admin resets a user's password
 */
router.post(
  '/:id/reset-password',
  [body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      user.password = req.body.newPassword;
      await user.save();

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
