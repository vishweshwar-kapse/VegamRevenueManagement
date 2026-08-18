/**
 * Format a numeric value for display as a complete, grouped figure with an
 * optional currency prefix.  Used consistently across all list pages, KPI
 * strips and drawers.
 *
 * Figures are never abbreviated to K / M — finance users need the exact
 * amount.  Decimals are shown only when the value actually has them, so
 * whole amounts stay clean while invoice-level paise/cents are preserved.
 */
export function fmt(value: number, currency?: string): string {
  const prefix = currency ? `${currency} ` : '';
  const n = Number.isFinite(value) ? value : 0;
  return `${prefix}${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
