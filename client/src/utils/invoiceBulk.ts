import { Customer, CustomerPlant, PO, Invoice } from '@/types';
import { CreateInvoicePayload } from '@/api/invoices';
import {
  loadExcelJS, workbookToBlob, styleHeaderRow, setupSheet, addHeaderHints, refRange,
  cellToString, parseAmount, parseDate, writeFailedRows, FailedRow,
} from './excelBulk';

/**
 * Bulk upload for Invoices. One spreadsheet row = one draft invoice billing a
 * single PO line (the common case). Customers/sites/POs are referenced by
 * code/number and resolved to IDs; currency is derived server-side from the PO.
 * Invoices are always created as drafts (issue them from the list afterwards).
 */

export const TEMPLATE_HEADERS = [
  'Customer Code',
  'Site Code',
  'Invoice Date',
  'Pay By Date',
  'PO Number',
  'Amount',
  'Line Description',
  'Tax Amount',
  'Tax Description',
  'Description',
  'Notes',
] as const;

const COL = {
  customerCode: 1, siteCode: 2, invoiceDate: 3, payByDate: 4, poNumber: 5,
  amount: 6, lineDescription: 7, taxAmount: 8, taxDescription: 9, description: 10, notes: 11,
} as const;

const WIDTHS = [16, 16, 14, 14, 16, 14, 30, 12, 18, 30, 28];
const SHEET_NAME = 'Invoices';

export interface InvoiceRefData {
  customers: Customer[];
  plants: CustomerPlant[];
  pos: PO[];
}

const idOf = (v: unknown) => (typeof v === 'string' ? v : (v as { _id: string })?._id);
const name = (v: unknown, key: string) => (v && typeof v === 'object' ? String((v as any)[key] ?? '') : '');
const poKey = (customerId: string, poNumber: string) => `${customerId}|${poNumber.toLowerCase()}`;
const STATUS_EXPORT: Record<string, string> = {
  draft: 'Draft', issued: 'Issued', partial: 'Partially Paid', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled',
};

// ── 1. Template / error workbook (shared shell) ─────────────────────────────────

// Shared shell (dropdowns, hints, Reference sheet). With dataRows it becomes the
// error file: failed rows written under the header with the bad cells flagged,
// keeping the same dropdowns/Reference data as the template.
async function buildWorkbook(ref: InvoiceRefData, dataRows: FailedRow[] = []): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet(SHEET_NAME);
  setupSheet(ws, TEMPLATE_HEADERS as unknown as string[], WIDTHS);

  for (let r = 2; r <= 500; r += 1) {
    if (ref.customers.length) ws.getCell(r, COL.customerCode).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('A', ref.customers.length)] };
    if (ref.plants.length) ws.getCell(r, COL.siteCode).dataValidation = { type: 'list', allowBlank: true, formulae: [refRange('C', ref.plants.length)] };
    if (ref.pos.length) ws.getCell(r, COL.poNumber).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('F', ref.pos.length)] };
  }

  addHeaderHints(ws, {
    [COL.customerCode]: 'Required. Pick a Customer Code (see Reference sheet).',
    [COL.siteCode]: 'Optional. Billing site; defaults from the PO if left blank.',
    [COL.invoiceDate]: 'Required. Invoice date, e.g. 2026-04-15.',
    [COL.payByDate]: 'Required. Payment due date, e.g. 2026-05-15.',
    [COL.poNumber]: 'Required. PO being billed; must belong to the customer and not be cancelled.',
    [COL.amount]: 'Required. Line amount (number > 0).',
    [COL.taxAmount]: 'Optional. Tax amount (number ≥ 0).',
  });

  writeFailedRows(ws, dataRows);

  // Reference sheet: Customer=A, Site=C, PO=F (dropdown sources).
  const refWs = wb.addWorksheet('Reference');
  refWs.columns = [
    { width: 16 }, { width: 28 }, { width: 16 }, { width: 26 }, { width: 24 },
    { width: 18 }, { width: 24 }, { width: 18 },
  ];
  styleHeaderRow(refWs.addRow([
    'Customer Code', 'Customer Name',
    'Site Code', 'Site Name', 'Belongs to Customer',
    'PO Number', 'PO Customer', 'PO Remaining',
  ]));
  const rows = Math.max(ref.customers.length, ref.plants.length, ref.pos.length);
  for (let i = 0; i < rows; i += 1) {
    const c = ref.customers[i]; const p = ref.plants[i]; const po = ref.pos[i];
    const remaining = po ? (po.remainingValue ?? ((po.effectivePOValue ?? po.poValue) - (po.invoicedValue || 0))) : '';
    refWs.addRow([
      c?.code ?? '', c?.name ?? '',
      p?.plantCode ?? '', p?.plantName ?? '', name(p?.customerId, 'name'),
      po?.poNumber ?? '', name(po?.customerId, 'name'), remaining,
    ]);
  }

  return workbookToBlob(wb);
}

export const generateTemplate = (ref: InvoiceRefData): Promise<Blob> => buildWorkbook(ref);

// ── 2. Parse & validate ────────────────────────────────────────────────────────

export interface ParsedResult {
  valid: { rowNumber: number; payload: CreateInvoicePayload }[];
  failed: FailedRow[];
  totalDataRows: number;
}

export async function parseAndValidate(file: File, ref: InvoiceRefData): Promise<ParsedResult> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) throw new Error('The uploaded file has no worksheets.');

  const customerByCode = new Map(ref.customers.map((c) => [c.code.toLowerCase(), c]));
  const plantByCode = new Map(ref.plants.map((p) => [p.plantCode.toLowerCase(), p]));
  // POs keyed by customer + number, since PO numbers are unique per customer.
  const poByKey = new Map(ref.pos.map((po) => [poKey(String(idOf(po.customerId)), po.poNumber), po]));

  const valid: ParsedResult['valid'] = [];
  const failed: FailedRow[] = [];
  let totalDataRows = 0;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: (string | number | null)[] = [];
    for (let c = 1; c <= TEMPLATE_HEADERS.length; c += 1) values.push(cellToString(row.getCell(c).value) || null);
    if (values.every((v) => v === null || v === '')) return;
    totalDataRows += 1;

    const errors: FailedRow['errors'] = [];
    const get = (col: number) => cellToString(row.getCell(col).value);

    const customer = customerByCode.get(get(COL.customerCode).toLowerCase());
    if (!get(COL.customerCode)) errors.push({ col: COL.customerCode, message: 'Customer Code is required' });
    else if (!customer) errors.push({ col: COL.customerCode, message: `No customer with code "${get(COL.customerCode)}"` });

    // Site optional
    let plantId: string | undefined;
    const siteCode = get(COL.siteCode);
    if (siteCode) {
      const plant = plantByCode.get(siteCode.toLowerCase());
      if (!plant) errors.push({ col: COL.siteCode, message: `No site with code "${siteCode}"` });
      else if (customer && String(idOf(plant.customerId)) !== customer._id) {
        errors.push({ col: COL.siteCode, message: `Site does not belong to customer "${get(COL.customerCode)}"` });
      } else plantId = plant._id;
    }

    const invRes = parseDate(row.getCell(COL.invoiceDate).value);
    let invoiceDate = '';
    if ('error' in invRes) errors.push({ col: COL.invoiceDate, message: invRes.error });
    else invoiceDate = invRes.iso;

    const payRes = parseDate(row.getCell(COL.payByDate).value);
    let payByDate = '';
    if ('error' in payRes) errors.push({ col: COL.payByDate, message: payRes.error });
    else payByDate = payRes.iso;

    // PO — resolved within the customer.
    let po: PO | undefined;
    const poNumber = get(COL.poNumber);
    if (!poNumber) errors.push({ col: COL.poNumber, message: 'PO Number is required' });
    else if (customer) {
      po = poByKey.get(poKey(customer._id, poNumber));
      if (!po) errors.push({ col: COL.poNumber, message: `No PO "${poNumber}" for customer "${get(COL.customerCode)}"` });
      else if (po.status === 'cancelled') errors.push({ col: COL.poNumber, message: `PO "${poNumber}" is cancelled` });
    }

    const amtRes = parseAmount(row.getCell(COL.amount).value);
    let amount = 0;
    if ('error' in amtRes) errors.push({ col: COL.amount, message: amtRes.error });
    else if (amtRes.num <= 0) errors.push({ col: COL.amount, message: 'Amount must be greater than 0' });
    else amount = amtRes.num;

    let taxAmount = 0;
    if (get(COL.taxAmount)) {
      const tRes = parseAmount(row.getCell(COL.taxAmount).value);
      if ('error' in tRes) errors.push({ col: COL.taxAmount, message: tRes.error });
      else taxAmount = tRes.num;
    }

    if (errors.length > 0) { failed.push({ values, errors }); return; }

    valid.push({
      rowNumber,
      payload: {
        customerId: customer!._id,
        plantId,
        invoiceDate,
        payByDate,
        lineItems: [{ poId: po!._id, description: get(COL.lineDescription) || undefined, amount }],
        taxAmount,
        taxDescription: get(COL.taxDescription) || undefined,
        description: get(COL.description) || undefined,
        notes: get(COL.notes) || undefined,
      },
    });
  });

  return { valid, failed, totalDataRows };
}

// ── 3. Server-rejected row → commented error row ────────────────────────────────

export function payloadToFailedRow(payload: CreateInvoicePayload, ref: InvoiceRefData, message: string): FailedRow {
  const customer = ref.customers.find((c) => c._id === payload.customerId);
  const plant = ref.plants.find((p) => p._id === payload.plantId);
  const line = payload.lineItems[0];
  const po = ref.pos.find((x) => x._id === line?.poId);
  return {
    values: [
      customer?.code ?? '', plant?.plantCode ?? '',
      payload.invoiceDate, payload.payByDate,
      po?.poNumber ?? '', line?.amount ?? '', line?.description ?? '',
      payload.taxAmount ?? '', payload.taxDescription ?? '',
      payload.description ?? '', payload.notes ?? '',
    ],
    errors: [{ col: COL.poNumber, message }],
  };
}

export const buildInvoiceErrorWorkbook = (ref: InvoiceRefData, failed: FailedRow[]): Promise<Blob> =>
  buildWorkbook(ref, failed);

// ── 4. Export ───────────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Invoice #', 'Customer', 'Site', 'Invoice Date', 'Pay By', 'Currency',
  'Invoice Value', 'Tax', 'Total', 'Status', 'Line Items', 'Outstanding', 'Created',
];

export async function exportInvoices(invoices: Invoice[]): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet('Invoices');
  setupSheet(ws, EXPORT_HEADERS, [16, 24, 22, 12, 12, 10, 14, 12, 14, 12, 11, 14, 12]);

  const d = (s?: string) => (s ? new Date(s).toISOString().slice(0, 10) : '');
  invoices.forEach((inv) => {
    ws.addRow([
      inv.invoiceNumber,
      name(inv.customerId, 'name'),
      name(inv.plantId, 'plantName'),
      d(inv.invoiceDate),
      d(inv.payByDate),
      inv.currency ?? '',
      inv.invoiceValue ?? 0,
      inv.taxAmount ?? 0,
      inv.totalAmount ?? 0,
      STATUS_EXPORT[inv.status] ?? inv.status,
      (inv.lineItems || []).length,
      inv.outstandingAmount ?? 0,
      d(inv.createdAt),
    ]);
  });

  return workbookToBlob(wb);
}
