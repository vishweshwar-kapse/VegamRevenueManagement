import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import CurrencyRateGrid from '../models/CurrencyRate';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

// Fetch the singleton grid, creating a default one on first access so the
// admin screen always has something to render.
async function getOrCreateGrid() {
  let grid = await CurrencyRateGrid.findOne();
  if (!grid) {
    grid = await CurrencyRateGrid.create({
      currencies: ['INR', 'USD', 'EUR'],
      rows: [],
    });
  }
  return grid;
}

// ─── Get the grid ───────────────────────────────────────────────────────────────

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const grid = await getOrCreateGrid();
    res.json({ success: true, data: grid });
  } catch (error) {
    next(error);
  }
});

// ─── Save the grid ──────────────────────────────────────────────────────────────
// Replaces the whole matrix (columns + rows) in one call — mirrors how the
// editable grid is saved on the client.

const saveValidation = [
  body('currencies')
    .isArray({ min: 1 }).withMessage('At least one currency column is required'),
  body('currencies.*')
    .isString().trim().notEmpty().withMessage('Currency code cannot be blank'),
  body('rows')
    .isArray().withMessage('Rows must be an array'),
  body('rows.*.month')
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('rows.*.year')
    .isInt({ min: 2000, max: 2100 }).withMessage('Year is out of range'),
];

router.put(
  '/',
  authorize('finance_admin'),
  saveValidation,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const currencies: string[] = req.body.currencies.map((c: string) => c.trim().toUpperCase());
      const rows = (req.body.rows || []).map((r: any) => {
        const normalizedRates: Record<string, Record<string, number>> = {};

        for (const fromCur of currencies) {
          const fromValues = r.rates?.[fromCur];
          const nextRates: Record<string, number> = {};

          for (const toCur of currencies) {
            if (fromCur === toCur) {
              nextRates[toCur] = 1;
              continue;
            }

            const value = fromValues?.[toCur];
            if (value === undefined || value === null || value === '') {
              continue;
            }

            const parsed = Number(value);
            const isValid = Number.isFinite(parsed) && parsed > 0 && /^\d+(\.\d{1,2})?$/.test(String(value));
            if (!isValid) {
              res.status(400).json({
                success: false,
                message: `Invalid rate for ${fromCur} -> ${toCur}. Use a positive value with up to two decimal places.`,
              });
              return;
            }

            nextRates[toCur] = Number(parsed.toFixed(2));
          }

          normalizedRates[fromCur] = nextRates;
        }

        return { month: r.month, year: r.year, rates: normalizedRates };
      });

      const grid = await getOrCreateGrid();
      grid.currencies = currencies;
      grid.rows = rows as any;
      grid.updatedBy = req.user?._id as any;
      await grid.save();

      res.json({ success: true, data: grid });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
