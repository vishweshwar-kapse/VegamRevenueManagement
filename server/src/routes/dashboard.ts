import { Router, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Forecast from '../models/Forecast';
import Invoice from '../models/Invoice';
import SOW from '../models/SOW';
import PO from '../models/PO';
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

/** Convert "FY26-27" → { start: 2026-04-01, end: 2027-03-31T23:59:59 } */
function fyDateRange(fy: string): { start: Date; end: Date } {
  const startYY = parseInt(fy.replace('FY', '').split('-')[0], 10);
  const fyStartYear = startYY < 50 ? 2000 + startYY : 1900 + startYY;
  return {
    start: new Date(fyStartYear, 3, 1),
    end: new Date(fyStartYear + 1, 3, 0, 23, 59, 59), // last day of March
  };
}

router.get('/summary', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const fy = (req.query.fy as string) || currentFY();
    const forecastFilter: Record<string, unknown> = { isActive: true };
    const siteFilter: Record<string, unknown> = {};

    // Forecast users: scope to assigned sites
    const isForecastUser = req.user && FORECAST_ROLES.includes(req.user.role as any) && req.user.role !== 'finance_admin';
    if (isForecastUser) {
      const user = await User.findById(req.user!._id).lean();
      const allowedSites = user?.assignedSites || [];
      forecastFilter.plantId = { $in: allowedSites };
      siteFilter.plantId = { $in: allowedSites };
    }

    // ── Forecast KPIs ─────────────────────────────────────────────────────────
    const allForecasts = await Forecast.find(forecastFilter).lean();
    const fyForecasts  = allForecasts.filter((f) => f.fy === fy);

    const totalForecastValue = fyForecasts.reduce((s, f) => s + f.totalValue, 0);
    const signedValue        = fyForecasts.filter((f) => f.status === 'signed').reduce((s, f) => s + f.totalValue, 0);
    const projectedValue     = fyForecasts.filter((f) => f.status === 'projected').reduce((s, f) => s + f.totalValue, 0);
    const conversionRate     = totalForecastValue > 0
      ? Math.round((signedValue / totalForecastValue) * 1000) / 10
      : 0;

    const qTotals = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const f of fyForecasts) {
      const dist = f.distributions.find((d) => d.fy === fy);
      if (dist) {
        qTotals.q1 += dist.q1; qTotals.q2 += dist.q2;
        qTotals.q3 += dist.q3; qTotals.q4 += dist.q4;
      }
    }

    const activeSiteIds     = [...new Set(fyForecasts.map((f) => String(f.plantId)))];
    const activeCustomerIds = [...new Set(fyForecasts.map((f) => String(f.customerId)))];

    // ── Invoice KPIs ──────────────────────────────────────────────────────────
    const { start: fyStart, end: fyEnd } = fyDateRange(fy);
    const now = new Date();

    // All active, non-cancelled invoices in the FY (by invoiceDate)
    const fyInvoices = await Invoice.find({
      isActive: true,
      status: { $nin: ['draft', 'cancelled'] },
      invoiceDate: { $gte: fyStart, $lte: fyEnd },
      ...siteFilter,
    }).lean();

    const revenueInvoiced = fyInvoices.reduce((s, inv) => s + (inv.invoiceValue || 0), 0);
    const revenueRealized = fyInvoices
      .filter((inv) => inv.status === 'paid')
      .reduce((s, inv) => s + (inv.invoiceValue || 0), 0);

    // Outstanding: all live (non-cancelled, non-paid, non-draft) invoices — not FY-scoped
    const liveInvoices = await Invoice.find({
      isActive: true,
      status: { $in: ['issued', 'partial', 'overdue'] },
      ...siteFilter,
    }).lean();

    const outstandingReceivables = liveInvoices.reduce((s, inv) => s + (inv.invoiceValue || 0), 0);

    // Overdue: explicit 'overdue' status OR issued/partial with payByDate in the past
    const overdueInvoices = liveInvoices.filter(
      (inv) => inv.status === 'overdue' || (inv.payByDate && new Date(inv.payByDate) < now)
    );
    const overdueReceivables = overdueInvoices.reduce((s, inv) => s + (inv.invoiceValue || 0), 0);

    // ── Commercial counts ─────────────────────────────────────────────────────
    const openSOWs = await SOW.countDocuments({
      isActive: true,
      status: { $nin: ['closed', 'archived'] },
      ...siteFilter,
    });

    const openPOs = await PO.countDocuments({
      isActive: true,
      status: { $in: ['open', 'partial'] },
      ...siteFilter,
    });

    // ── Alerts ────────────────────────────────────────────────────────────────
    const alerts: { severity: string; message: string; count: number; link?: string }[] = [];

    if (overdueInvoices.length > 0) {
      alerts.push({
        severity: 'critical',
        message: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''} past due date`,
        count: overdueInvoices.length,
        link: '/invoices',
      });
    }

    const draftInvoiceCount = await Invoice.countDocuments({
      isActive: true,
      status: 'draft',
      ...siteFilter,
    });
    if (draftInvoiceCount > 0) {
      alerts.push({
        severity: 'warning',
        message: `${draftInvoiceCount} draft invoice${draftInvoiceCount > 1 ? 's' : ''} pending issue`,
        count: draftInvoiceCount,
        link: '/invoices',
      });
    }

    res.json({
      success: true,
      data: {
        fy,
        currency: 'USD',
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
        revenueInvoiced,
        revenueRealized,
        outstandingReceivables,
        overdueReceivables,
        openSOWs,
        openPOs,
        alerts,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
