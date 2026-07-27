import type ExcelJS from 'exceljs';
import { Entity, Customer, CustomerPlant, Forecast, ForecastStatus } from '@/types';
import { CreateForecastPayload } from '@/api/forecasts';

// ExcelJS (~900 kB) is loaded on demand so it stays out of the page chunk and
// is only fetched when a bulk action actually runs.
const loadExcelJS = async () => (await import('exceljs')).default;

/**
 * Bulk-upload helpers for Forecasts.
 *
 * One spreadsheet row = one forecast with a single-FY quarterly distribution
 * (the common case). Entities, customers and sites are referenced by their
 * human-readable codes and resolved to IDs during validation.
 */

// Template column order. 1-based indices are used when attaching per-cell
// error comments to the returned error workbook, so keep COL in sync.
export const TEMPLATE_HEADERS = [
  'Entity Code',
  'Customer Code',
  'Site Code',
  'Description',
  'Primary FY',
  'Status',
  'Q1 Amount',
  'Q2 Amount',
  'Q3 Amount',
  'Q4 Amount',
  'Notes',
] as const;

const COL = {
  entityCode: 1,
  customerCode: 2,
  siteCode: 3,
  description: 4,
  fy: 5,
  status: 6,
  q1: 7,
  q2: 8,
  q3: 9,
  q4: 10,
  notes: 11,
} as const;

const SHEET_NAME = 'Forecasts';
const HEADER_ARGB = 'FF1F4E78'; // dark blue
const ERROR_ARGB = 'FFFDE7E9'; // light red

export interface ForecastRefData {
  entities: Entity[];
  customers: Customer[];
  plants: CustomerPlant[];
}

export interface FailedRow {
  values: (string | number | null)[];
  errors: { col: number; message: string }[];
}

export interface ParsedResult {
  valid: { rowNumber: number; payload: CreateForecastPayload }[];
  failed: FailedRow[];
  totalDataRows: number;
}

const STATUS_LABELS: Record<ForecastStatus, string> = {
  forecast_projected: 'Forecast Projected',
  partial_sow_partial_projected: 'Partial SoW/Partial Projected',
  partial_sow_partial_closed: 'Partial SoW/Partial Closed',
  forecast_cancelled: 'Forecast Cancelled',
};

// Accept both the friendly labels and the raw status codes (case-insensitive).
const STATUS_BY_INPUT: Record<string, ForecastStatus> = (() => {
  const m: Record<string, ForecastStatus> = {};
  (Object.keys(STATUS_LABELS) as ForecastStatus[]).forEach((code) => {
    m[code.toLowerCase()] = code;
    m[STATUS_LABELS[code].toLowerCase()] = code;
  });
  return m;
})();

const FY_PATTERN = /^FY\d{2}-\d{2}$/i;

export function getFYOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  return [-1, 0, 1, 2].map((offset) => {
    const s = fyStart + offset;
    return `FY${String(s).slice(-2)}-${String(s + 1).slice(-2)}`;
  });
}

// ── Cell readers ─────────────────────────────────────────────────────────────

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Rich text / formula result / hyperlink shapes
    const anyVal = value as any;
    if (Array.isArray(anyVal.richText)) return anyVal.richText.map((r: any) => r.text).join('').trim();
    if ('text' in anyVal) return String(anyVal.text).trim();
    if ('result' in anyVal) return String(anyVal.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}

/** Returns { num } for a valid non-negative number, or { error } describing why not. */
function parseAmount(value: ExcelJS.CellValue): { num: number } | { error: string } {
  const s = cellToString(value);
  if (s === '') return { num: 0 };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { error: 'Not a valid number' };
  if (n < 0) return { error: 'Must be ≥ 0' };
  return { num: n };
}

// ── Blob helpers ─────────────────────────────────────────────────────────────

async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
  });
  row.height = 20;
}

function setupForecastSheet(ws: ExcelJS.Worksheet): void {
  ws.columns = [
    { width: 14 }, { width: 16 }, { width: 16 }, { width: 40 }, { width: 12 },
    { width: 26 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 30 },
  ];
  const header = ws.addRow(TEMPLATE_HEADERS as unknown as string[]);
  styleHeaderRow(header);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// ── 1. Template / error workbook (shared shell) ─────────────────────────────────

// Builds the workbook shell — dropdowns, header hints and Reference sheet —
// shared by both the blank template and the validation-error file. When
// dataRows are supplied, they are written under the header and the failed cells
// are highlighted with a comment, so the error file keeps the same dropdowns and
// Reference data as the template.
async function buildForecastWorkbook(ref: ForecastRefData, dataRows: FailedRow[] = []): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet(SHEET_NAME);
  setupForecastSheet(ws);

  const fyOptions = getFYOptions();
  const statusList = Object.values(STATUS_LABELS);

  // Dropdown validation on the first 500 data rows. Entity/Customer/Site pull
  // from Reference-sheet ranges (inline lists are capped at 255 chars and the
  // code lists can be long); FY/Status are short enough to inline.
  const refRange = (col: string, count: number) => `Reference!$${col}$2:$${col}$${count + 1}`;
  for (let r = 2; r <= 500; r += 1) {
    if (ref.entities.length > 0) {
      ws.getCell(r, COL.entityCode).dataValidation = {
        type: 'list', allowBlank: false, formulae: [refRange('A', ref.entities.length)],
        showErrorMessage: true, errorTitle: 'Invalid entity',
        error: 'Pick an Entity Code from the dropdown (see the Reference sheet).',
      };
    }
    if (ref.customers.length > 0) {
      ws.getCell(r, COL.customerCode).dataValidation = {
        type: 'list', allowBlank: false, formulae: [refRange('C', ref.customers.length)],
        showErrorMessage: true, errorTitle: 'Invalid customer',
        error: 'Pick a Customer Code from the dropdown (see the Reference sheet).',
      };
    }
    if (ref.plants.length > 0) {
      ws.getCell(r, COL.siteCode).dataValidation = {
        type: 'list', allowBlank: false, formulae: [refRange('E', ref.plants.length)],
        showErrorMessage: true, errorTitle: 'Invalid site',
        error: 'Pick a Site Code from the dropdown — it must belong to the chosen customer (see the Reference sheet).',
      };
    }
    ws.getCell(r, COL.fy).dataValidation = {
      type: 'list', allowBlank: false, formulae: [`"${fyOptions.join(',')}"`],
    };
    ws.getCell(r, COL.status).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${statusList.join(',')}"`],
    };
  }

  // Header hover-comments for guidance — deliberately NO example data row, so
  // nothing gets accidentally imported from the template itself.
  const header = ws.getRow(1);
  const hint = (col: number, text: string) => { header.getCell(col).note = text; };
  hint(COL.entityCode, 'Required. Must match an Entity Code on the Reference sheet.');
  hint(COL.customerCode, 'Required. Must match a Customer Code on the Reference sheet.');
  hint(COL.siteCode, 'Required. A Site Code belonging to that customer (see Reference sheet).');
  hint(COL.description, 'Required. Free-text description of the forecast.');
  hint(COL.fy, `Required. Financial year, e.g. ${fyOptions[1]}.`);
  hint(COL.status, 'Optional. Defaults to "Forecast Projected".');
  hint(COL.q1, 'Quarter amount (number ≥ 0). At least one quarter must be > 0.');

  // Error file: write the failed rows and flag the offending cells.
  dataRows.forEach((f) => {
    const dataRow = ws.addRow(f.values);
    f.errors.forEach(({ col, message }) => {
      const cell = dataRow.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ERROR_ARGB } };
      cell.note = { texts: [{ text: message }], margins: { insetmode: 'auto' } } as ExcelJS.Comment;
    });
  });

  // Reference sheet — the dropdowns above pull their lists from fixed columns
  // here: Entity Code = A, Customer Code = C, Site Code = E (all starting row 2).
  // Keep this layout in sync with the refRange() calls.
  const refWs = wb.addWorksheet('Reference');
  refWs.columns = [
    { width: 18 }, { width: 30 }, // A,B Entity
    { width: 18 }, { width: 30 }, // C,D Customer
    { width: 18 }, { width: 30 }, { width: 28 }, // E,F,G Site
  ];
  styleHeaderRow(refWs.addRow([
    'Entity Code', 'Entity Name',
    'Customer Code', 'Customer Name',
    'Site Code', 'Site Name', 'Belongs to Customer',
  ]));

  const rows = Math.max(ref.entities.length, ref.customers.length, ref.plants.length);
  for (let i = 0; i < rows; i += 1) {
    const e = ref.entities[i];
    const c = ref.customers[i];
    const p = ref.plants[i];
    const pCust = p
      ? (typeof p.customerId === 'string' ? '' : (p.customerId as Customer)?.name ?? '')
      : '';
    refWs.addRow([
      e?.entityCode ?? '', e?.name ?? '',
      c?.code ?? '', c?.name ?? '',
      p?.plantCode ?? '', p?.plantName ?? '', pCust,
    ]);
  }

  return workbookToBlob(wb);
}

export const generateTemplate = (ref: ForecastRefData): Promise<Blob> => buildForecastWorkbook(ref);

// ── 2. Parse & validate an uploaded file ────────────────────────────────────────

export async function parseAndValidate(file: File, ref: ForecastRefData): Promise<ParsedResult> {
  const Excel = await loadExcelJS();
  const buffer = await file.arrayBuffer();
  const wb = new Excel.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) throw new Error('The uploaded file has no worksheets.');

  // Lookup maps (case-insensitive on code).
  const entityByCode = new Map(ref.entities.map((e) => [e.entityCode.toLowerCase(), e]));
  const customerByCode = new Map(ref.customers.map((c) => [c.code.toLowerCase(), c]));
  const plantByCode = new Map(ref.plants.map((p) => [p.plantCode.toLowerCase(), p]));

  const valid: ParsedResult['valid'] = [];
  const failed: FailedRow[] = [];
  let totalDataRows = 0;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header

    const values: (string | number | null)[] = [];
    for (let c = 1; c <= TEMPLATE_HEADERS.length; c += 1) {
      values.push(cellToString(row.getCell(c).value) || null);
    }
    // Skip completely empty rows.
    if (values.every((v) => v === null || v === '')) return;
    totalDataRows += 1;

    const errors: FailedRow['errors'] = [];
    const get = (col: number) => cellToString(row.getCell(col).value);

    // Entity
    const entityCode = get(COL.entityCode);
    const entity = entityByCode.get(entityCode.toLowerCase());
    if (!entityCode) errors.push({ col: COL.entityCode, message: 'Entity Code is required' });
    else if (!entity) errors.push({ col: COL.entityCode, message: `No entity with code "${entityCode}"` });

    // Customer
    const customerCode = get(COL.customerCode);
    const customer = customerByCode.get(customerCode.toLowerCase());
    if (!customerCode) errors.push({ col: COL.customerCode, message: 'Customer Code is required' });
    else if (!customer) errors.push({ col: COL.customerCode, message: `No customer with code "${customerCode}"` });

    // Site (and it must belong to the customer)
    const siteCode = get(COL.siteCode);
    const plant = plantByCode.get(siteCode.toLowerCase());
    if (!siteCode) {
      errors.push({ col: COL.siteCode, message: 'Site Code is required' });
    } else if (!plant) {
      errors.push({ col: COL.siteCode, message: `No site with code "${siteCode}"` });
    } else if (customer) {
      const plantCustId = typeof plant.customerId === 'string' ? plant.customerId : plant.customerId?._id;
      if (String(plantCustId) !== customer._id) {
        errors.push({ col: COL.siteCode, message: `Site "${siteCode}" does not belong to customer "${customerCode}"` });
      }
    }

    // Description
    const description = get(COL.description);
    if (!description) errors.push({ col: COL.description, message: 'Description is required' });

    // FY
    const fy = get(COL.fy);
    if (!fy) errors.push({ col: COL.fy, message: 'Primary FY is required' });
    else if (!FY_PATTERN.test(fy)) errors.push({ col: COL.fy, message: 'Primary FY must look like FY25-26' });

    // Status (optional)
    const statusRaw = get(COL.status);
    let status: ForecastStatus = 'forecast_projected';
    if (statusRaw) {
      const resolved = STATUS_BY_INPUT[statusRaw.toLowerCase()];
      if (!resolved) errors.push({ col: COL.status, message: `Unknown status "${statusRaw}"` });
      else status = resolved;
    }

    // Quarter amounts
    const qCols: number[] = [COL.q1, COL.q2, COL.q3, COL.q4];
    const qVals: number[] = [0, 0, 0, 0];
    qCols.forEach((col, i) => {
      const res = parseAmount(row.getCell(col).value);
      if ('error' in res) errors.push({ col, message: res.error });
      else qVals[i] = res.num;
    });
    const total = qVals.reduce((s, n) => s + n, 0);
    if (errors.every((e) => !qCols.includes(e.col)) && total <= 0) {
      errors.push({ col: COL.q1, message: 'At least one quarter amount must be greater than 0' });
    }

    if (errors.length > 0) {
      failed.push({ values, errors });
      return;
    }

    valid.push({
      rowNumber,
      payload: {
        entityId: entity!._id,
        customerId: customer!._id,
        plantId: plant!._id,
        description,
        fy,
        status,
        distributions: [{ fy, q1: qVals[0], q2: qVals[1], q3: qVals[2], q4: qVals[3], total }],
        notes: get(COL.notes) || undefined,
        projection: total,
      },
    });
  });

  return { valid, failed, totalDataRows };
}

/**
 * Rebuild a template row (with the server's rejection comment) from a payload
 * that passed client validation but was rejected by the API during upload.
 */
export function payloadToFailedRow(
  payload: CreateForecastPayload,
  ref: ForecastRefData,
  message: string
): FailedRow {
  const entity = ref.entities.find((e) => e._id === payload.entityId);
  const customer = ref.customers.find((c) => c._id === payload.customerId);
  const plant = ref.plants.find((p) => p._id === payload.plantId);
  const d = payload.distributions[0];
  return {
    values: [
      entity?.entityCode ?? '',
      customer?.code ?? '',
      plant?.plantCode ?? '',
      payload.description,
      payload.fy,
      payload.status ? STATUS_LABELS[payload.status] : '',
      d?.q1 ?? 0, d?.q2 ?? 0, d?.q3 ?? 0, d?.q4 ?? 0,
      payload.notes ?? '',
    ],
    errors: [{ col: COL.description, message }],
  };
}

// ── 3. Error workbook — same shell as the template, plus the failed rows ─────────

export const buildErrorWorkbook = (ref: ForecastRefData, failed: FailedRow[]): Promise<Blob> =>
  buildForecastWorkbook(ref, failed);

// ── 4. Export current records ───────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Forecast ID', 'Entity', 'Customer', 'Site', 'Description', 'Primary FY',
  'Status', 'Currency', 'Total Value', 'Signed Value', 'Projected Value',
  'Distributions', 'Owner', 'Created',
];

export async function exportForecasts(forecasts: Forecast[]): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet('Forecasts');
  ws.columns = [
    { width: 16 }, { width: 18 }, { width: 24 }, { width: 22 }, { width: 40 }, { width: 12 },
    { width: 22 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 30 },
    { width: 18 }, { width: 12 },
  ];
  styleHeaderRow(ws.addRow(EXPORT_HEADERS));
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const name = (v: unknown, key: string) =>
    v && typeof v === 'object' ? String((v as any)[key] ?? '') : '';

  forecasts.forEach((f) => {
    const projected = f.projectedValue ?? Math.max(f.totalValue - (f.signedValue || 0), 0);
    const dist = (f.distributions || []).map((d) => `${d.fy}: ${d.total.toLocaleString()}`).join(' | ');
    ws.addRow([
      f.forecastId,
      name(f.entityId, 'name'),
      name(f.customerId, 'name'),
      name(f.plantId, 'plantName'),
      f.description,
      f.fy,
      STATUS_LABELS[f.status] ?? f.status,
      f.currency,
      f.totalValue,
      f.signedValue || 0,
      projected,
      dist,
      name(f.ownerId, 'name'),
      f.createdAt ? new Date(f.createdAt).toISOString().slice(0, 10) : '',
    ]);
  });

  return workbookToBlob(wb);
}
