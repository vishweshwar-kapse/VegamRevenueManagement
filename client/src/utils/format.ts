/**
 * Format a numeric value for display, scaling to K / M with an optional
 * currency prefix.  Used consistently across all list pages and drawers.
 */
export function fmt(value: number, currency?: string): string {
  const prefix = currency ? `${currency} ` : '';
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `${prefix}${(value / 1_000).toFixed(0)}K`;
  return `${prefix}${value.toLocaleString()}`;
}
