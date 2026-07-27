/**
 * Invoice line-item construction & billing rules.
 *
 * Both "create draft" and "update draft" need the same guarantees before an
 * invoice can bill a set of POs:
 *   1. every referenced PO exists and is active,
 *   2. every PO belongs to the invoice's customer,
 *   3. all POs on one invoice share a single currency.
 *
 * This module owns those rules so the route handlers stay thin. Rule
 * violations are thrown as HTTP-aware errors (via createError) and surface
 * through the shared errorHandler — routes only need their usual
 * try/catch → next(error).
 */

import mongoose from 'mongoose';
import PO from '../models/PO';
import { Currency } from '../models/Invoice';
import { createError } from '../middleware/errorHandler';

/** A line item as supplied by the client (before enrichment). */
export interface RawLineItem {
  poId: string;
  amount: number | string;
  description?: string;
}

/** A fully-built, persisted-shape line item. */
export interface BuiltLineItem {
  poId: mongoose.Types.ObjectId;
  poNumber: string;
  description: string;
  amount: number;
}

export interface BuiltInvoiceLines {
  lineItems: BuiltLineItem[];
  poIds: mongoose.Types.ObjectId[];
  invoiceValue: number;
  currency: Currency;
  /** First billed PO's plant — used as the invoice's default plant when none is given. */
  defaultPlantId?: mongoose.Types.ObjectId;
}

/**
 * Validate the referenced POs against the billing rules and build the
 * enriched invoice line items.
 *
 * @param customerId  The invoice's customer; every PO must belong to it.
 * @param rawLineItems  Client-supplied { poId, amount, description? } entries.
 * @throws AppError(400) if any billing rule is violated.
 */
export async function buildInvoiceLineItems(
  customerId: mongoose.Types.ObjectId | string,
  rawLineItems: RawLineItem[]
): Promise<BuiltInvoiceLines> {
  const poIds = rawLineItems.map((l) => l.poId);
  const pos = await PO.find({ _id: { $in: poIds }, isActive: true });

  if (pos.length !== poIds.length) {
    throw createError('One or more POs were not found', 400);
  }

  if (pos.some((p) => String(p.customerId) !== String(customerId))) {
    throw createError('All POs must belong to the selected customer', 400);
  }

  if (new Set(pos.map((p) => p.currency)).size > 1) {
    throw createError('All POs on one invoice must share the same currency', 400);
  }

  const poById = new Map(pos.map((p) => [String(p._id), p]));

  const lineItems: BuiltLineItem[] = rawLineItems.map((l) => {
    const po = poById.get(String(l.poId))!;
    return {
      poId: po._id as mongoose.Types.ObjectId,
      poNumber: po.poNumber,
      description: (l.description && String(l.description).trim()) || po.milestones || `PO ${po.poNumber}`,
      amount: Number(l.amount),
    };
  });

  return {
    lineItems,
    poIds: lineItems.map((l) => l.poId),
    invoiceValue: lineItems.reduce((sum, l) => sum + l.amount, 0),
    currency: pos[0].currency,
    defaultPlantId: pos[0].plantId,
  };
}
