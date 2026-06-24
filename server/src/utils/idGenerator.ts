/**
 * Human-readable ID generators for each entity.
 * Format: PREFIX-YYYY-NNNN (zero-padded sequence)
 */

import mongoose from 'mongoose';

/**
 * Generate a sequential ID with a given prefix.
 * Queries the collection to find the highest existing sequence.
 */
async function generateSequentialId(
  collection: mongoose.Collection,
  field: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const last = await collection.findOne<Record<string, any>>(
    { [field]: { $regex: `^${pattern}` } },
    { sort: { [field]: -1 } }
  );

  let seq = 1;
  if (last && typeof last[field] === 'string') {
    const parts = (last[field] as string).split('-');
    const lastSeq = parseInt(parts[parts.length - 1] || '0', 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${pattern}${String(seq).padStart(4, '0')}`;
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
