import { Customer, CustomerPlant, SOW, PO } from '@/types';
import { CreatePOPayload } from '@/api/pos';
import {
  loadExcelJS, workbookToBlob, styleHeaderRow, setupSheet, addHeaderHints, refRange,
  cellToString, parseAmount, parseDate, writeFailedRows, FailedRow,
} from './excelBulk';

/**
 * Bulk upload for POs. One spreadsheet row = one PO with a single SOW
 * allocation (the common case). Customers/sites/SOWs are referenced by code/ID
 * and resolved to Mongo IDs. Allocation amount defaults to the PO value.
 */

export const TEMPLATE_HEADERS = [
  'PO Number',
  'Customer Code',
  'Site Code',
  'PO Date',
  'PO Value',
  'SOW ID',
  'Allocation Amount',
  'Milestones',
  'Notes',
] as const;

const COL = {
  poNumber: 1, customerCode: 2, siteCode: 3, poDate: 4, poValue: 5,
  sowId: 6, allocAmount: 7, milestones: 8, notes: 9,
} as const;

const WIDTHS = [16, 16, 16, 14, 14, 16, 16, 30, 28];
const SHEET_NAME = 'POs';

export interface PoRefData {
  customers: Customer[];
  plants: CustomerPlant[];
  sows: SOW[];
}

const custId = (v: unknown) => (typeof v === 'string' ? v : (v as { _id: string })?._id);
const name = (v: unknown, key: string) => (v && typeof v === 'object' ? String((v as any)[key] ?? '') : '');
const STATUS_EXPORT: Record<string, string> = { open: 'Open', partial: 'Partial', closed: 'Closed', cancelled: 'Cancelled' };

// ── 1. Template / error workbook (shared shell) ─────────────────────────────────

// Shared shell (dropdowns, hints, Reference sheet). With dataRows it becomes the
// error file: failed rows written under the header with the bad cells flagged,
// keeping the same dropdowns/Reference data as the template.
async function buildWorkbook(ref: PoRefData, dataRows: FailedRow[] = []): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet(SHEET_NAME);
  setupSheet(ws, TEMPLATE_HEADERS as unknown as string[], WIDTHS);

  for (let r = 2; r <= 500; r += 1) {
    if (ref.customers.length) ws.getCell(r, COL.customerCode).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('A', ref.customers.length)] };
    if (ref.plants.length) ws.getCell(r, COL.siteCode).dataValidation = { type: 'list', allowBlank: true, formulae: [refRange('C', ref.plants.length)] };
    if (ref.sows.length) ws.getCell(r, COL.sowId).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('F', ref.sows.length)] };
  }

  addHeaderHints(ws, {
    [COL.poNumber]: 'Required. Customer-issued PO number.',
    [COL.customerCode]: 'Required. Pick a Customer Code (see Reference sheet).',
    [COL.siteCode]: 'Optional. Site issuing the PO; must belong to the customer.',
    [COL.poDate]: 'Required. PO date, e.g. 2026-04-15.',
    [COL.poValue]: 'Required. PO value (number > 0).',
    [COL.sowId]: 'Required. SOW this PO confirms; must belong to the customer.',
    [COL.allocAmount]: 'Optional. Amount attributed to the SOW. Defaults to the PO value.',
  });

  // Error file: write the failed rows and flag the offending cells.
  writeFailedRows(ws, dataRows);

  // Reference sheet: Customer=A, Site=C, SOW=F (dropdown sources).
  const refWs = wb.addWorksheet('Reference');
  refWs.columns = [
    { width: 16 }, { width: 28 }, { width: 16 }, { width: 26 }, { width: 24 },
    { width: 16 }, { width: 34 }, { width: 24 },
  ];
  styleHeaderRow(refWs.addRow([
    'Customer Code', 'Customer Name',
    'Site Code', 'Site Name', 'Belongs to Customer',
    'SOW ID', 'SOW Title', 'SOW Customer',
  ]));
  const rows = Math.max(ref.customers.length, ref.plants.length, ref.sows.length);
  for (let i = 0; i < rows; i += 1) {
    const c = ref.customers[i]; const p = ref.plants[i]; const s = ref.sows[i];
    refWs.addRow([
      c?.code ?? '', c?.name ?? '',
      p?.plantCode ?? '', p?.plantName ?? '', name(p?.customerId, 'name'),
      s?.sowId ?? '', s?.title ?? '', name(s?.customerId, 'name'),
    ]);
  }

  return workbookToBlob(wb);
}

export const generateTemplate = (ref: PoRefData): Promise<Blob> => buildWorkbook(ref);

// ── 2. Parse & validate ────────────────────────────────────────────────────────

export interface ParsedResult {
  valid: { rowNumber: number; payload: CreatePOPayload }[];
  failed: FailedRow[];
  totalDataRows: number;
}

export async function parseAndValidate(file: File, ref: PoRefData): Promise<ParsedResult> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) throw new Error('The uploaded file has no worksheets.');

  const customerByCode = new Map(ref.customers.map((c) => [c.code.toLowerCase(), c]));
  const plantByCode = new Map(ref.plants.map((p) => [p.plantCode.toLowerCase(), p]));
  const sowById = new Map(ref.sows.map((s) => [s.sowId.toLowerCase(), s]));

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

    if (!get(COL.poNumber)) errors.push({ col: COL.poNumber, message: 'PO Number is required' });

    const customer = customerByCode.get(get(COL.customerCode).toLowerCase());
    if (!get(COL.customerCode)) errors.push({ col: COL.customerCode, message: 'Customer Code is required' });
    else if (!customer) errors.push({ col: COL.customerCode, message: `No customer with code "${get(COL.customerCode)}"` });

    // Site optional
    let plantId: string | undefined;
    const siteCode = get(COL.siteCode);
    if (siteCode) {
      const plant = plantByCode.get(siteCode.toLowerCase());
      if (!plant) errors.push({ col: COL.siteCode, message: `No site with code "${siteCode}"` });
      else if (customer && String(custId(plant.customerId)) !== customer._id) {
        errors.push({ col: COL.siteCode, message: `Site does not belong to customer "${get(COL.customerCode)}"` });
      } else plantId = plant._id;
    }

    const dateRes = parseDate(row.getCell(COL.poDate).value);
    let poDate = '';
    if ('error' in dateRes) errors.push({ col: COL.poDate, message: dateRes.error });
    else poDate = dateRes.iso;

    const valRes = parseAmount(row.getCell(COL.poValue).value);
    let poValue = 0;
    if ('error' in valRes) errors.push({ col: COL.poValue, message: valRes.error });
    else if (valRes.num <= 0) errors.push({ col: COL.poValue, message: 'PO Value must be greater than 0' });
    else poValue = valRes.num;

    const sow = sowById.get(get(COL.sowId).toLowerCase());
    if (!get(COL.sowId)) errors.push({ col: COL.sowId, message: 'SOW ID is required' });
    else if (!sow) errors.push({ col: COL.sowId, message: `No SOW with ID "${get(COL.sowId)}"` });
    else if (customer && String(custId(sow.customerId)) !== customer._id) {
      errors.push({ col: COL.sowId, message: `SOW does not belong to customer "${get(COL.customerCode)}"` });
    }

    // Allocation amount — defaults to PO value when blank.
    let allocAmount = poValue;
    if (get(COL.allocAmount)) {
      const aRes = parseAmount(row.getCell(COL.allocAmount).value);
      if ('error' in aRes) errors.push({ col: COL.allocAmount, message: aRes.error });
      else if (aRes.num <= 0) errors.push({ col: COL.allocAmount, message: 'Allocation Amount must be greater than 0' });
      else allocAmount = aRes.num;
    }

    if (errors.length > 0) { failed.push({ values, errors }); return; }

    valid.push({
      rowNumber,
      payload: {
        poNumber: get(COL.poNumber),
        customerId: customer!._id,
        plantId,
        poDate,
        poValue,
        allocations: [{ sowId: sow!._id, amount: allocAmount }],
        milestones: get(COL.milestones) || undefined,
        notes: get(COL.notes) || undefined,
      },
    });
  });

  return { valid, failed, totalDataRows };
}

// ── 3. Server-rejected row → commented error row ────────────────────────────────

export function payloadToFailedRow(payload: CreatePOPayload, ref: PoRefData, message: string): FailedRow {
  const customer = ref.customers.find((c) => c._id === payload.customerId);
  const plant = ref.plants.find((p) => p._id === payload.plantId);
  const alloc = payload.allocations[0];
  const sow = ref.sows.find((s) => s._id === alloc?.sowId);
  return {
    values: [
      payload.poNumber, customer?.code ?? '', plant?.plantCode ?? '',
      payload.poDate, payload.poValue,
      sow?.sowId ?? '', alloc?.amount ?? '',
      payload.milestones ?? '', payload.notes ?? '',
    ],
    errors: [{ col: COL.poNumber, message }],
  };
}

export const buildPoErrorWorkbook = (ref: PoRefData, failed: FailedRow[]): Promise<Blob> =>
  buildWorkbook(ref, failed);

// ── 4. Export ───────────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'PO Number', 'Customer', 'Site', 'PO Date', 'PO Value', 'Effective Value',
  'Invoiced', 'Remaining', 'Currency', 'Status', 'Linked SOWs', 'Created',
];

export async function exportPos(pos: PO[]): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet('POs');
  setupSheet(ws, EXPORT_HEADERS, [16, 24, 22, 12, 14, 14, 14, 14, 10, 12, 12, 12]);

  pos.forEach((p) => {
    ws.addRow([
      p.poNumber,
      name(p.customerId, 'name'),
      name(p.plantId, 'plantName'),
      p.poDate ? new Date(p.poDate).toISOString().slice(0, 10) : '',
      p.poValue || 0,
      p.effectivePOValue ?? p.poValue ?? 0,
      p.invoicedValue || 0,
      p.remainingValue ?? 0,
      p.currency ?? '',
      STATUS_EXPORT[p.status] ?? p.status,
      (p.allocations || []).length,
      p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : '',
    ]);
  });

  return workbookToBlob(wb);
}
