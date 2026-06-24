/**
 * PO → SOW → Forecast signed-state cascade.
 *
 * A Purchase Order confirms ("signs") a portion of a SOW's value via per-SOW
 * allocations. When a PO is created, updated, cancelled, or removed, the
 * affected SOWs — and the Forecasts those SOWs roll up into — must have their
 * signed amounts and statuses recomputed.
 *
 * The recompute is intentionally derived-from-scratch (it re-queries every
 * active PO that allocates to a SOW) so it is idempotent: running it twice
 * yields the same result, and it self-heals after any partial write.
 */

import mongoose from 'mongoose';
import SOW from '../models/SOW';
import Forecast from '../models/Forecast';
import PO from '../models/PO';

/** Statuses a SOW can be driven INTO by PO acceptance. */
const ACCEPTED = 'accepted';
const PARTIALLY_ACCEPTED = 'partially_accepted';
/** Terminal statuses the cascade must never overwrite. */
const TERMINAL_SOW_STATUSES = ['closed', 'archived'];

function toObjectId(id: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Recompute signed value + status for the given SOWs, then cascade the
 * aggregate signed value up into every Forecast those SOWs are linked to.
 *
 * @param sowIds  SOWs whose PO linkage may have changed (pass the union of
 *                old and new allocation targets when editing a PO).
 * @param userId  Acting user, recorded in forecast history (optional).
 */
export async function recomputeSignedState(
  sowIds: (mongoose.Types.ObjectId | string)[],
  userId?: mongoose.Types.ObjectId
): Promise<void> {
  // Dedupe — a PO edit can list the same SOW in both old and new sets.
  const uniqueSowIds = Array.from(new Set(sowIds.map(String))).map(toObjectId);
  const affectedForecastIds = new Set<string>();

  for (const sowId of uniqueSowIds) {
    const sow = await SOW.findById(sowId);
    if (!sow || !sow.isActive) continue;

    // Every active, non-cancelled PO that allocates to this SOW.
    const pos = await PO.find({
      isActive: true,
      status: { $ne: 'cancelled' },
      'allocations.sowId': sowId,
    }).lean();

    let signed = 0;
    for (const po of pos) {
      for (const alloc of po.allocations || []) {
        if (String(alloc.sowId) === String(sowId)) signed += alloc.amount;
      }
    }

    sow.signedValue = signed;
    sow.linkedPOIds = pos.map((p) => p._id as mongoose.Types.ObjectId);

    const total = sow.totalValue || 0;
    if (!TERMINAL_SOW_STATUSES.includes(sow.status)) {
      if (total > 0 && signed >= total) {
        sow.status = ACCEPTED;
      } else if (signed > 0) {
        sow.status = PARTIALLY_ACCEPTED;
      } else {
        // No PO coverage left — fall back to a pre-acceptance state.
        sow.status = sow.forecastId ? 'linked' : 'draft';
      }
    }

    await sow.save();
    if (sow.forecastId) affectedForecastIds.add(String(sow.forecastId));
  }

  for (const forecastId of affectedForecastIds) {
    await recomputeForecast(forecastId, userId);
  }
}

/**
 * Roll a forecast's signed/projected values up from its linked SOWs.
 * signedValue = Σ(signed value of every active SOW linked to this forecast).
 */
async function recomputeForecast(
  forecastId: string,
  userId?: mongoose.Types.ObjectId
): Promise<void> {
  const forecast = await Forecast.findById(forecastId);
  if (!forecast || !forecast.isActive) return;

  const linkedSOWs = await SOW.find({ forecastId: forecast._id, isActive: true }).lean();

  const signed = linkedSOWs.reduce((sum, s) => sum + (s.signedValue || 0), 0);
  const total = forecast.totalValue || 0;
  const previous = forecast.signedValue;

  forecast.signedValue = signed;
  forecast.projectedValue = Math.max(total - signed, 0);

  // Union of all POs feeding the linked SOWs.
  const poIds = new Set<string>();
  for (const s of linkedSOWs) {
    for (const p of s.linkedPOIds || []) poIds.add(String(p));
  }
  forecast.linkedPOIds = Array.from(poIds).map(toObjectId);

  if (forecast.status !== 'closed') {
    forecast.status = total > 0 && signed >= total ? 'signed' : 'projected';
  }

  if (previous !== signed && userId) {
    forecast.history.push({
      action: 'po_signed_update',
      changedBy: userId as mongoose.Types.ObjectId,
      changedAt: new Date(),
      previousValue: previous,
      newValue: signed,
      remarks: 'Signed value updated from linked PO allocations',
    });
  }

  await forecast.save();
}
