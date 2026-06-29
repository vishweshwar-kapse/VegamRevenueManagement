/**
 * Invoice → PO drawdown.
 *
 * Issuing an invoice draws down the invoiced/remaining value of each PO it
 * bills and moves the PO's status along the open → partial → closed track.
 * Cancelling a previously-issued invoice reverses that drawdown.
 *
 * The PO pre('save') hook recomputes remainingValue = effectivePOValue −
 * invoicedValue, so this service only adjusts invoicedValue and status.
 */

import PO from '../models/PO';
import { IInvoiceLineItem } from '../models/Invoice';

type Direction = 'apply' | 'reverse';

function poStatusFor(invoiced: number, effective: number): 'open' | 'partial' | 'closed' {
  if (effective > 0 && invoiced >= effective) return 'closed';
  if (invoiced > 0) return 'partial';
  return 'open';
}

async function adjust(lineItems: IInvoiceLineItem[], direction: Direction): Promise<void> {
  const sign = direction === 'apply' ? 1 : -1;

  for (const item of lineItems) {
    const po = await PO.findById(item.poId);
    if (!po || !po.isActive) continue;

    // Clamp at zero so a double-reverse can never push invoicedValue negative.
    const nextInvoiced = Math.max((po.invoicedValue || 0) + sign * item.amount, 0);
    po.invoicedValue = nextInvoiced;

    const effective = po.effectivePOValue || po.poValue || 0;
    // Never override a manually cancelled PO.
    if (po.status !== 'cancelled') {
      po.status = poStatusFor(nextInvoiced, effective);
    }

    await po.save();
  }
}

/** Increase each billed PO's invoicedValue and advance its status. */
export function applyInvoiceDrawdown(lineItems: IInvoiceLineItem[]): Promise<void> {
  return adjust(lineItems, 'apply');
}

/** Reverse a previously-applied drawdown (invoice cancelled). */
export function reverseInvoiceDrawdown(lineItems: IInvoiceLineItem[]): Promise<void> {
  return adjust(lineItems, 'reverse');
}
