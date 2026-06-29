/**
 * Human-readable ID generators for each entity.
 * Format: PREFIX-YYYY-NNNN (zero-padded sequence)
 */

import mongoose from 'mongoose';

/** Escape any regex metacharacters in a literal prefix before using it in $regex. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a sequential ID with a given prefix (e.g. "SOW-2026-0003").
 *
 * Computes the next sequence from the true NUMERIC maximum of the trailing
 * counter across all matching IDs — never a lexicographic sort. Lexicographic
 * ordering is unsafe when padding is inconsistent (e.g. legacy "SOW-2026-001"
 * sorts above "SOW-2026-0002"), which would otherwise regenerate an existing
 * ID and trigger a duplicate-key error.
 */
async function generateSequentialId(
  collection: mongoose.Collection,
  field: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  const docs = await collection
    .find({ [field]: { $regex: `^${escapeRegex(pattern)}` } })
    .project({ [field]: 1 })
    .toArray();

  let maxSeq = 0;
  for (const doc of docs) {
    const value = (doc as Record<string, unknown>)[field];
    if (typeof value === 'string') {
      const match = value.match(/(\d+)$/);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
  }

  return `${pattern}${String(maxSeq + 1).padStart(4, '0')}`;
}

export async function generateForecastId(): Promise<string> {
  const col = mongoose.connection.collection('forecasts');
  return generateSequentialId(col, 'forecastId', 'FCST');
}

export async function generateSOWId(customerCode?: string): Promise<string> {
  const col = mongoose.connection.collection('sows');
  const prefix = customerCode ? `SOW-${customerCode}` : 'SOW';
  return generateSequentialId(col, 'sowId', prefix);
}

export async function generateInvoiceNumber(): Promise<string> {
  const col = mongoose.connection.collection('invoices');
  return generateSequentialId(col, 'invoiceNumber', 'INV');
}

export async function generateBatchId(): Promise<string> {
  const col = mongoose.connection.collection('bulkuploadbatches');
  return generateSequentialId(col, 'batchId', 'BATCH');
}

export async function generateCustomerCode(prefix: string): Promise<string> {
  const col = mongoose.connection.collection('customers');
  const count = await col.countDocuments();
  return `${prefix.toUpperCase().slice(0, 4)}${String(count + 1).padStart(3, '0')}`;
}
