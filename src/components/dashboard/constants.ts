/** Dashboard panel shell: calm border, no glass/tinted fill (accent lives in icon pills + metric strips). */
export const DASHBOARD_CARD_CLASS =
  'rounded-xl overflow-hidden border border-border/60 min-h-[200px] bg-card shadow-sm';

/** Inner metric / summary strip: calm border only; semantic color on text/icon pills. */
export const DASHBOARD_METRIC_STRIP_CLASS =
  'rounded-lg border border-border/60 px-2.5 py-2 bg-card';

/** Short month names (es) for period labels. */
const MONTH_NAMES_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

type PeriodInput = {
  view: string;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
};

/** Returns a short label for the dashboard period (e.g. "Feb 2026", "1-15 Feb 2026"). */
export function getPeriodLabel({
  view,
  year,
  month,
  period,
}: PeriodInput): string {
  const m = MONTH_NAMES_SHORT[month - 1] ?? '';
  if (view === 'month') return `${m} ${year}`;
  const lastDay = new Date(year, month, 0).getDate();
  return period === 'FIRST'
    ? `1-15 ${m} ${year}`
    : `16-${lastDay} ${m} ${year}`;
}

/** Grid class for dashboard tab content (responsive 1/2/3 columns). */
export const DASHBOARD_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5';
