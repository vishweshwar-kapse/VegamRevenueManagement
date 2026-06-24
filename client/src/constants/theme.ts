// ── Design tokens ─────────────────────────────────────────────────────────────
// Single source of truth for colours and type scale used across all modules.
// Reference these instead of hardcoding hex literals or raw px values.

export const COLORS = {
  primary:       '#1677ff',
  success:       '#52c41a',
  error:         '#ff4d4f',
  purple:        '#722ed1',
  textSecondary: '#8c8c8c',
  bgSubtle:      '#fafafa',
  bgHighlight:   '#f0f5ff',
  borderLight:   '#f0f0f0',
} as const;

export const FONT_SIZE = {
  xs:  11,
  sm:  12,
  md:  13,
  lg:  14,
  xl:  18,
} as const;

// ── Status colour maps ────────────────────────────────────────────────────────
// Colocated here so both list pages and form drawers stay in sync.

import type { ForecastStatus, SOWStatus, POStatus } from '@/types';

export const FORECAST_STATUS_COLORS: Record<ForecastStatus, string> = {
  projected: 'blue',
  signed:    'green',
  closed:    'default',
};

export const SOW_STATUS_COLORS: Record<SOWStatus, string> = {
  draft:              'default',
  submitted:          'blue',
  linked:             'cyan',
  partially_accepted: 'gold',
  accepted:           'green',
  closed:             'orange',
  archived:           'red',
};

export const SOW_STATUS_LABELS: Record<SOWStatus, string> = {
  draft:              'Draft',
  submitted:          'Submitted',
  linked:             'Linked',
  partially_accepted: 'Partially Accepted',
  accepted:           'Accepted',
  closed:             'Closed',
  archived:           'Archived',
};

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  open:      'blue',
  partial:   'gold',
  closed:    'green',
  cancelled: 'red',
};
