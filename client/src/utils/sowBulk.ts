import { Entity, Customer, CustomerPlant, Forecast, SOW, SOWStatus } from '@/types';
import { CreateSOWPayload } from '@/api/sows';
import {
  loadExcelJS, workbookToBlob, styleHeaderRow, setupSheet, addHeaderHints, refRange,
  cellToString, parseAmount, parseDate, writeFailedRows, FailedRow,
} from './excelBulk';

/**
 * Bulk upload for SOWs. One spreadsheet row = one SOW with a single milestone
 * (the common case). Entities/customers/sites are referenced by code and
 * resolved to IDs. An optional Forecast ID links an existing forecast; if left
 * blank the SOW auto-creates a forecast from the milestone (matching the drawer).
 */

export const TEMPLATE_HEADERS = [
  'Entity Code',
  'Customer Code',
  'Site Code',
  'Title',
  'Description',
  'Status',
  'Milestone Description',
  'Milestone Amount',
  'Milestone Delivery Date',
  'Link Forecast ID',
  'Notes',
] as const;

const COL = {
  entityCode: 1, customerCode: 2, siteCode: 3, title: 4, description: 5, status: 6,
  msDescription: 7, msAmount: 8, msDate: 9, forecastId: 10, notes: 11,
} as const;

const WIDTHS = [14, 16, 16, 34, 30, 20, 30, 14, 20, 18, 28];
const SHEET_NAME = 'SOWs';

export interface SowRefData {
  entities: Entity[];
  customers: Customer[];
  plants: CustomerPlant[];
  forecasts: Forecast[];
}

// Only these statuses may be set on import; accepted / partially_accepted are
// system-managed (derived from linked POs).
const SELECTABLE: { code: SOWStatus; label: string }[] = [
  { code: 'draft', label: 'Draft' },
  { code: 'submitted', label: 'Submitted' },
  { code: 'linked', label: 'Linked' },
  { code: 'closed', label: 'Closed/Cancelled' },
  { code: 'archived', label: 'Archived' },
];
const STATUS_BY_INPUT: Record<string, SOWStatus> = (() => {
  const m: Record<string, SOWStatus> = {};
  SELECTABLE.forEach(({ code, label }) => { m[code.toLowerCase()] = code; m[label.toLowerCase()] = code; });
  return m;
})();
const SYSTEM_STATUSES = ['accepted', 'partially_accepted', 'fully accepted', 'partially accepted'];
const STATUS_EXPORT: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', linked: 'Linked',
  partially_accepted: 'Partially Accepted', accepted: 'Fully Accepted',
  closed: 'Closed/Cancelled', archived: 'Archived',
};

const custId = (v: unknown) => (typeof v === 'string' ? v : (v as { _id: string })?._id);
const name = (v: unknown, key: string) => (v && typeof v === 'object' ? String((v as any)[key] ?? '') : '');

// ── 1. Template / error workbook (shared shell) ─────────────────────────────────

// Shared shell (dropdowns, hints, Reference sheet). With dataRows it becomes the
// error file: failed rows written under the header with the bad cells flagged,
// keeping the same dropdowns/Reference data as the template.
async function buildWorkbook(ref: SowRefData, dataRows: FailedRow[] = []): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet(SHEET_NAME);
  setupSheet(ws, TEMPLATE_HEADERS as unknown as string[], WIDTHS);

  const statusList = SELECTABLE.map((s) => s.label);
  for (let r = 2; r <= 500; r += 1) {
    if (ref.entities.length) ws.getCell(r, COL.entityCode).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('A', ref.entities.length)] };
    if (ref.customers.length) ws.getCell(r, COL.customerCode).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('C', ref.customers.length)] };
    if (ref.plants.length) ws.getCell(r, COL.siteCode).dataValidation = { type: 'list', allowBlank: false, formulae: [refRange('E', ref.plants.length)] };
    ws.getCell(r, COL.status).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${statusList.join(',')}"`] };
    if (ref.forecasts.length) ws.getCell(r, COL.forecastId).dataValidation = { type: 'list', allowBlank: true, formulae: [refRange('H', ref.forecasts.length)] };
  }

  addHeaderHints(ws, {
    [COL.entityCode]: 'Required. Pick an Entity Code (see Reference sheet).',
    [COL.customerCode]: 'Required. Pick a Customer Code (see Reference sheet).',
    [COL.siteCode]: 'Required. Pick a Site Code belonging to that customer.',
    [COL.title]: 'Required. SOW title.',
    [COL.status]: 'Optional. Defaults to Draft. (Accepted statuses are set automatically from POs.)',
    [COL.msAmount]: 'Milestone amount (number > 0).',
    [COL.msDate]: 'Milestone delivery date, e.g. 2026-04-15.',
    [COL.forecastId]: 'Optional. Link an existing Forecast ID; leave blank to auto-create one.',
  });

  // Error file: write the failed rows and flag the offending cells.
  writeFailedRows(ws, dataRows);

  // Reference sheet: Entity=A, Customer=C, Site=E, Forecast=H (dropdown sources).
  const refWs = wb.addWorksheet('Reference');
  refWs.columns = [
    { width: 16 }, { width: 28 }, { width: 16 }, { width: 28 },
    { width: 16 }, { width: 26 }, { width: 24 }, { width: 18 }, { width: 34 }, { width: 24 },
  ];
  styleHeaderRow(refWs.addRow([
    'Entity Code', 'Entity Name', 'Customer Code', 'Customer Name',
    'Site Code', 'Site Name', 'Belongs to Customer',
    'Forecast ID', 'Forecast Description', 'Forecast Customer',
  ]));
  const rows = Math.max(ref.entities.length, ref.customers.length, ref.plants.length, ref.forecasts.length);
  for (let i = 0; i < rows; i += 1) {
    const e = ref.entities[i]; const c = ref.customers[i]; const p = ref.plants[i]; const f = ref.forecasts[i];
    refWs.addRow([
      e?.entityCode ?? '', e?.name ?? '',
      c?.code ?? '', c?.name ?? '',
      p?.plantCode ?? '', p?.plantName ?? '', name(p?.customerId, 'name'),
      f?.forecastId ?? '', f?.description ?? '', name(f?.customerId, 'name'),
    ]);
  }

  return workbookToBlob(wb);
}

export const generateTemplate = (ref: SowRefData): Promise<Blob> => buildWorkbook(ref);

// ── 2. Parse & validate ────────────────────────────────────────────────────────

export interface ParsedResult {
  valid: { rowNumber: number; payload: CreateSOWPayload }[];
  failed: FailedRow[];
  totalDataRows: number;
}

export async function parseAndValidate(file: File, ref: SowRefData): Promise<ParsedResult> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) throw new Error('The uploaded file has no worksheets.');

  const entityByCode = new Map(ref.entities.map((e) => [e.entityCode.toLowerCase(), e]));
  const customerByCode = new Map(ref.customers.map((c) => [c.code.toLowerCase(), c]));
  const plantByCode = new Map(ref.plants.map((p) => [p.plantCode.toLowerCase(), p]));
  const forecastById = new Map(ref.forecasts.map((f) => [f.forecastId.toLowerCase(), f]));

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

    const entity = entityByCode.get(get(COL.entityCode).toLowerCase());
    if (!get(COL.entityCode)) errors.push({ col: COL.entityCode, message: 'Entity Code is required' });
    else if (!entity) errors.push({ col: COL.entityCode, message: `No entity with code "${get(COL.entityCode)}"` });

    const customer = customerByCode.get(get(COL.customerCode).toLowerCase());
    if (!get(COL.customerCode)) errors.push({ col: COL.customerCode, message: 'Customer Code is required' });
    else if (!customer) errors.push({ col: COL.customerCode, message: `No customer with code "${get(COL.customerCode)}"` });

    const plant = plantByCode.get(get(COL.siteCode).toLowerCase());
    if (!get(COL.siteCode)) errors.push({ col: COL.siteCode, message: 'Site Code is required' });
    else if (!plant) errors.push({ col: COL.siteCode, message: `No site with code "${get(COL.siteCode)}"` });
    else if (customer && String(custId(plant.customerId)) !== customer._id) {
      errors.push({ col: COL.siteCode, message: `Site does not belong to customer "${get(COL.customerCode)}"` });
    }

    if (!get(COL.title)) errors.push({ col: COL.title, message: 'Title is required' });

    let status: SOWStatus = 'draft';
    const statusRaw = get(COL.status);
    if (statusRaw) {
      if (SYSTEM_STATUSES.includes(statusRaw.toLowerCase())) {
        errors.push({ col: COL.status, message: 'This status is set automatically from linked POs — leave blank or use Draft/Submitted/Linked' });
      } else {
        const resolved = STATUS_BY_INPUT[statusRaw.toLowerCase()];
        if (!resolved) errors.push({ col: COL.status, message: `Unknown status "${statusRaw}"` });
        else status = resolved;
      }
    }

    if (!get(COL.msDescription)) errors.push({ col: COL.msDescription, message: 'Milestone Description is required' });
    const amtRes = parseAmount(row.getCell(COL.msAmount).value);
    let amount = 0;
    if ('error' in amtRes) errors.push({ col: COL.msAmount, message: amtRes.error });
    else if (amtRes.num <= 0) errors.push({ col: COL.msAmount, message: 'Milestone Amount must be greater than 0' });
    else amount = amtRes.num;

    const dateRes = parseDate(row.getCell(COL.msDate).value);
    let deliveryDate = '';
    if ('error' in dateRes) errors.push({ col: COL.msDate, message: dateRes.error });
    else deliveryDate = dateRes.iso;

    // Optional forecast link
    let forecastId: string | undefined;
    const fRaw = get(COL.forecastId);
    if (fRaw) {
      const f = forecastById.get(fRaw.toLowerCase());
      if (!f) errors.push({ col: COL.forecastId, message: `No forecast with ID "${fRaw}"` });
      else if (customer && String(custId(f.customerId)) !== customer._id) {
        errors.push({ col: COL.forecastId, message: 'Forecast belongs to a different customer' });
      } else forecastId = f._id;
    }

    if (errors.length > 0) { failed.push({ values, errors }); return; }

    valid.push({
      rowNumber,
      payload: {
        entityId: entity!._id,
        customerId: customer!._id,
        plantId: plant!._id,
        title: get(COL.title),
        description: get(COL.description) || undefined,
        status,
        milestones: [{ description: get(COL.msDescription), amount, deliveryDate }],
        forecastId,
        autoCreateForecast: !forecastId, // no explicit link → auto-create one
        notes: get(COL.notes) || undefined,
      },
    });
  });

  return { valid, failed, totalDataRows };
}

// ── 3. Server-rejected row → commented error row ────────────────────────────────

export function payloadToFailedRow(payload: CreateSOWPayload, ref: SowRefData, message: string): FailedRow {
  const entity = ref.entities.find((e) => e._id === payload.entityId);
  const customer = ref.customers.find((c) => c._id === payload.customerId);
  const plant = ref.plants.find((p) => p._id === payload.plantId);
  const forecast = ref.forecasts.find((f) => f._id === payload.forecastId);
  const m = payload.milestones[0];
  return {
    values: [
      entity?.entityCode ?? '', customer?.code ?? '', plant?.plantCode ?? '',
      payload.title, payload.description ?? '',
      payload.status ? (STATUS_EXPORT[payload.status] ?? payload.status) : '',
      m?.description ?? '', m?.amount ?? 0, m?.deliveryDate ?? '',
      forecast?.forecastId ?? '', payload.notes ?? '',
    ],
    errors: [{ col: COL.title, message }],
  };
}

export const buildSowErrorWorkbook = (ref: SowRefData, failed: FailedRow[]): Promise<Blob> =>
  buildWorkbook(ref, failed);

// ── 4. Export ───────────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  'SOW ID', 'Entity', 'Customer', 'Site', 'Title', 'Status', 'Currency',
  'Total Value', 'Signed Value', 'Milestones', 'Forecast', 'Created',
];

export async function exportSows(sows: SOW[]): Promise<Blob> {
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  wb.creator = 'Vegam Revenue Management';
  const ws = wb.addWorksheet('SOWs');
  setupSheet(ws, EXPORT_HEADERS, [16, 18, 24, 22, 36, 18, 10, 14, 14, 12, 16, 12]);

  sows.forEach((s) => {
    const total = s.totalValue ?? (s.milestones || []).reduce((sum, m) => sum + (m.amount || 0), 0);
    ws.addRow([
      s.sowId,
      name(s.entityId, 'name'),
      name(s.customerId, 'name'),
      name(s.plantId, 'plantName'),
      s.title,
      STATUS_EXPORT[s.status] ?? s.status,
      s.currency ?? '',
      total,
      s.signedValue || 0,
      (s.milestones || []).length,
      name(s.forecastId, 'forecastId'),
      s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '',
    ]);
  });

  return workbookToBlob(wb);
}
