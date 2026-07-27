import type ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Shared low-level Excel helpers for the bulk-upload features (Forecast, SOW, PO).
 * ExcelJS (~900 kB) is imported on demand so it stays out of the page chunks and
 * only loads when a bulk action actually runs.
 */

export const loadExcelJS = async () => (await import('exceljs')).default;

export const HEADER_ARGB = 'FF1F4E78'; // dark blue
export const ERROR_ARGB = 'FFFDE7E9'; // light red

export interface CellError {
  col: number; // 1-based column index
  message: string;
}

export interface FailedRow {
  values: (string | number | null)[];
  errors: CellError[];
}

// ── Cell readers ─────────────────────────────────────────────────────────────

export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dayjs(value).format('YYYY-MM-DD');
  if (typeof value === 'object') {
    const anyVal = value as any;
    if (Array.isArray(anyVal.richText)) return anyVal.richText.map((r: any) => r.text).join('').trim();
    if ('text' in anyVal) return String(anyVal.text).trim();
    if ('result' in anyVal) return String(anyVal.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}

/** Non-negative number, or an error describing why not. Blank → 0. */
export function parseAmount(value: ExcelJS.CellValue): { num: number } | { error: string } {
  const s = cellToString(value);
  if (s === '') return { num: 0 };
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isFinite(n)) return { error: 'Not a valid number' };
  if (n < 0) return { error: 'Must be ≥ 0' };
  return { num: n };
}

const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'DD MMM YYYY', 'YYYY/MM/DD'];

/** Parse a delivery/PO date cell to an ISO YYYY-MM-DD string, or an error. */
export function parseDate(value: ExcelJS.CellValue): { iso: string } | { error: string } {
  if (value === null || value === undefined || value === '') return { error: 'Date is required' };
  if (value instanceof Date) {
    // Excel dates come through as UTC midnight — read UTC parts to avoid a day shift.
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return { iso: `${y}-${m}-${d}` };
  }
  const s = cellToString(value);
  const parsed = dayjs(s, DATE_FORMATS, true);
  if (!parsed.isValid()) return { error: 'Use a date like 2026-04-15' };
  return { iso: parsed.format('YYYY-MM-DD') };
}

// ── Blob helpers ─────────────────────────────────────────────────────────────

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
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

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Sheet styling ────────────────────────────────────────────────────────────

export function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
  });
  row.height = 20;
}

/** Add a header row with the given widths, style it, and freeze the top row. */
export function setupSheet(ws: ExcelJS.Worksheet, headers: string[], widths: number[]): void {
  ws.columns = widths.map((w) => ({ width: w }));
  styleHeaderRow(ws.addRow(headers));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Attach hover-comments to header cells: { [colIndex]: text }. */
export function addHeaderHints(ws: ExcelJS.Worksheet, hints: Record<number, string>): void {
  const header = ws.getRow(1);
  Object.entries(hints).forEach(([col, text]) => {
    header.getCell(Number(col)).note = text;
  });
}

/** Range on the Reference sheet used to feed a dropdown, e.g. Reference!$A$2:$A$12. */
export function refRange(col: string, count: number): string {
  return `Reference!$${col}$2:$${col}$${count + 1}`;
}

// ── Failed-row overlay (for the error file) ─────────────────────────────────────

/**
 * Append failed rows to a sheet that already has the template header/dropdowns,
 * highlighting each failed cell and attaching the reason as a comment. This lets
 * the error file carry the exact same dropdowns and Reference data as the
 * template, so users can fix the flagged cells inline and re-upload.
 */
export function writeFailedRows(ws: ExcelJS.Worksheet, failed: FailedRow[]): void {
  failed.forEach((f) => {
    const row = ws.addRow(f.values);
    f.errors.forEach(({ col, message }) => {
      const cell = row.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ERROR_ARGB } };
      cell.note = { texts: [{ text: message }], margins: { insetmode: 'auto' } } as ExcelJS.Comment;
    });
  });
}
