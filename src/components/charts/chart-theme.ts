/** Chart colors from CSS variables so light and dark stay in sync. */
export const CHART_COLOR = {
  axis: 'var(--muted-foreground)',
  grid: 'var(--border)',
  primary: 'var(--primary)',
  income: 'var(--status-income)',
  expense: 'var(--status-expense)',
  pending: 'var(--status-pending)',
  success: 'var(--status-success)',
  info: 'var(--status-info)',
  popover: 'var(--popover)',
  background: 'var(--background)',
  slices: [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ],
} as const;

export const chartSliceColor = (index: number): string =>
  CHART_COLOR.slices[index % CHART_COLOR.slices.length];

export const CHART_AXIS_TICK = {
  fontSize: 11,
  fill: CHART_COLOR.axis,
} as const;
