import { Router, Response, NextFunction, Request } from 'express';
import { body, validationResult } from 'express-validator';
import Customer, { SFS_MODULES } from '../models/Customer';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { uploadContract } from '../middleware/upload';

const router = Router();
router.use(protect);

// ─── List ─────────────────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, isActive, industry, page = 1, limit = 50 } = req.query;

    const filter: Record<string, unknown> = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (industry) filter.industry = industry;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ name: 1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .populate('createdBy', 'name email')
      .select('-contractVersions -costStructure'); // Exclude large fields from list

    res.json({
      success: true,
      data: customers,
      pagination: { total, page: Number(page), limit: Number(limit) },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Get single ───────────────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('costStructure.lastUpdatedBy', 'name email')
      .populate('contractVersions.uploadedBy', 'name email');

    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// ─── Create ───────────────────────────────────────────────────────────────────

router.post(
  '/',
  authorize('finance_admin'),
  [
    body('name').trim().notEmpty().withMessage('Customer name is required'),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Customer code is required')
      .customSanitizer((v: string) => v?.toUpperCase())  // normalise before regex
      .matches(/^[A-Z0-9_-]{2,20}$/)
      .withMessage('Code must be 2–20 characters: letters, numbers, dash, underscore'),
    body('defaultCurrency')
      .isIn(['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'])
      .withMessage('Invalid currency'),
    body('defaultCreditPeriodDays')
      .isInt({ min: 0 })
      .withMessage('Credit period must be a non-negative integer'),
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
        code: req.body.code.toUpperCase(),
        createdBy: req.user?._id,
      });

      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Update basic info ────────────────────────────────────────────────────────

router.put(
  '/:id',
  authorize('finance_admin'),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be blank'),
    body('defaultCurrency')
      .optional()
      .isIn(['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'])
      .withMessage('Invalid currency'),
    body('defaultCreditPeriodDays')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Credit period must be a non-negative integer'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      // Prevent changing code or overwriting contract/cost data through this endpoint
      const { code, createdBy, contractVersions, costStructure, ...updates } = req.body;

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

// ─── Upload contract version ──────────────────────────────────────────────────

router.post(
  '/:id/contract',
  authorize('finance_admin'),
  (req: Request, res: Response, next: NextFunction) => {
    uploadContract(req, res, (err) => {
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

      const customer = await Customer.findById(req.params.id);
      if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }

      // Determine next version number
      const nextVersion =
        customer.contractVersions.length > 0
          ? Math.max(...customer.contractVersions.map((v) => v.version)) + 1
          : 1;

      // Mark all existing versions as not latest
      customer.contractVersions.forEach((v) => {
        v.isLatest = false;
      });

      // Add new version
      customer.contractVersions.push({
        version: nextVersion,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        isLatest: true,
        uploadedBy: req.user?._id as unknown as import('mongoose').Types.ObjectId,
        uploadedAt: new Date(),
        remarks: req.body.remarks || undefined,
      } as any);

      await customer.save();

      res.status(201).json({
        success: true,
        data: customer.contractVersions,
        message: `Contract version ${nextVersion} uploaded successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Save cost structure ──────────────────────────────────────────────────────

router.put(
  '/:id/cost-structure',
  authorize('finance_admin'),
  [
    body('currency')
      .isIn(['USD', 'INR', 'EUR', 'GBP', 'SGD', 'AED'])
      .withMessage('Valid currency is required'),
    body('manHourRates').isArray().withMessage('manHourRates must be an array'),
    body('manHourRates.*.roleType')
      .trim()
      .notEmpty()
      .withMessage('Role type is required for each rate'),
    body('manHourRates.*.ratePerHour')
      .isFloat({ min: 0 })
      .withMessage('Rate per hour must be a non-negative number'),
    body('moduleCosts').isArray().withMessage('moduleCosts must be an array'),
    body('moduleCosts.*.moduleName')
      .isIn(SFS_MODULES)
      .withMessage('Invalid module name'),
    body('moduleCosts.*.licenseCost')
      .isFloat({ min: 0 })
      .withMessage('License cost must be a non-negative number'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const customer = await Customer.findById(req.params.id);
      if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }

      customer.costStructure = {
        currency: req.body.currency,
        manHourRates: req.body.manHourRates || [],
        sfsDeploymentCost: req.body.sfsDeploymentCost,
        sfsDeploymentNotes: req.body.sfsDeploymentNotes,
        moduleCosts: req.body.moduleCosts || [],
        lastUpdatedBy: req.user?._id as unknown as import('mongoose').Types.ObjectId,
        lastUpdatedAt: new Date(),
      };

      await customer.save();

      res.json({ success: true, data: customer.costStructure, message: 'Cost structure saved' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Update corporate contacts ────────────────────────────────────────────────

router.put(
  '/:id/contacts',
  authorize('finance_admin'),
  [
    body('contacts').isArray().withMessage('contacts must be an array'),
    body('contacts.*.name').trim().notEmpty().withMessage('Contact name is required'),
    body('contacts.*.email').isEmail().withMessage('Valid email is required for each contact'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        { corporateContacts: req.body.contacts },
        { new: true, runValidators: true }
      );

      if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }

      res.json({ success: true, data: customer.corporateContacts });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
