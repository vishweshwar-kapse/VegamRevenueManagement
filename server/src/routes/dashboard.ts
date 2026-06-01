import { Router, Response, NextFunction } from 'express';
import Forecast from '../models/Forecast';
import User, { FORECAST_ROLES } from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(protect);

function currentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
}

router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fy = (req.query.fy as string) || currentFY();
    const filter: Record<string, unknown> = { isActive: true };

    // Forecast users: scope to assigned sites; others: full view
    const isForecastUser = req.user && FORECAST_ROLES.includes(req.user.role as any) && req.user.role !== 'finance_admin';
    if (isForecastUser) {
      const user = await User.findById(req.user!._id).lean();
      filter.plantId = { $in: user?.assignedSites || [] };
    }

    // All forecasts (not FY-filtered) for lifetime totals
    const allForecasts = await Forecast.find(filter).lean();
    // FY-filtered for period stats
    const fyForecasts = allForecasts.filter((f) => f.fy === fy);

    const totalForecastValue = fyForecasts.reduce((s, f) => s + f.totalValue, 0);
    const signedValue = fyForecasts.filter((f) => f.status === 'signed').reduce((s, f) => s + f.totalValue, 0);
    const projectedValue = fyForecasts.filter((f) => f.status === 'projected').reduce((s, f) => s + f.totalValue, 0);
    const conversionRate = totalForecastValue > 0
      ? Math.round((signedValue / totalForecastValue) * 1000) / 10
      : 0;

    const qTotals = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const f of fyForecasts) {
      const dist = f.distributions.find((d) => d.fy === fy);
      if (dist) {
        qTotals.q1 += dist.q1;
        qTotals.q2 += dist.q2;
        qTotals.q3 += dist.q3;
        qTotals.q4 += dist.q4;
      }
    }

    // Unique sites and customers with forecasts
    const activeSiteIds = [...new Set(fyForecasts.map((f) => String(f.plantId)))];
    const activeCustomerIds = [...new Set(fyForecasts.map((f) => String(f.customerId)))];

    res.json({
      success: true,
      data: {
        fy,
        currency: 'USD',           // Cross-currency display — future: convert to base currency
        forecast: {
          totalForecastValue,
          signedValue,
          projectedValue,
          conversionRate,
          forecastCount: fyForecasts.length,
          quarterly: qTotals,
          activeSites: activeSiteIds.length,
          activeCustomers: activeCustomerIds.length,
        },
        // These will be populated once invoice/payment modules are built
        revenueInvoiced: 0,
        revenueRealized: 0,
        outstandingReceivables: 0,
        overdueReceivables: 0,
        openSOWs: 0,
        openPOs: 0,
        alerts: [],
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
