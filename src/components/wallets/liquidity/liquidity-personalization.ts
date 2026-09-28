import {
  formatChartAxisMonth,
  formatChartMonthRange,
  formatMonthYearTitle,
  formatRowDate,
} from '@/lib/calendar-dates';
import {
  LIQUIDITY_CHART_RANGE_OPTIONS,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/lib/finance/liquidity-chart-range';

export type { LiquidityChartRangeId, LiquidityCustomChartRange };
export { LIQUIDITY_CHART_RANGE_OPTIONS };

export const formatLiquidityDateLabel = (
  ymd: string,
  now: Date = new Date(),
): string => formatRowDate(ymd, now);

export const formatMonthYearLabel = (
  monthKey: string,
  now: Date = new Date(),
): string => formatMonthYearTitle(monthKey, now);

export const formatShortMonthLabel = (
  monthKey: string,
  now: Date = new Date(),
): string => formatChartAxisMonth(monthKey, now);

/** Compact trigger copy for a custom from/to window, e.g. "jul – sep". */
export const formatCustomChartRangeLabel = (
  fromMonthKey: string,
  toMonthKey: string,
  now: Date = new Date(),
): string => formatChartMonthRange(fromMonthKey, toMonthKey, now);

export const compareMonthKeys = (a: string, b: string): number => a.localeCompare(b);

export const monthKeyFromParts = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

/** Payroll deductions can make expected income negative; never show that as “Entra”. */
export const displayIncomingCash = (expectedIncomeTotal: number): number =>
  Math.max(0, expectedIncomeTotal);

export const shiftSelectedMonthKey = (
  monthKeys: readonly string[],
  currentKey: string,
  delta: number,
): string => {
  if (monthKeys.length === 0) return currentKey;
  const index = monthKeys.indexOf(currentKey);
  const from = index >= 0 ? index : 0;
  const next = Math.min(monthKeys.length - 1, Math.max(0, from + delta));
  return monthKeys[next] ?? currentKey;
};

/** Prefer the current month when it is visible in the chart window. */
export const resolveInitialMonthKey = (
  monthKeys: readonly string[],
  asOfYmd: string,
): string => {
  if (monthKeys.length === 0) return '';
  const currentMonthKey = asOfYmd.slice(0, 7);
  if (monthKeys.includes(currentMonthKey)) return currentMonthKey;
  return monthKeys[0] ?? '';
};

const formatMonthYearFromYmd = (ymd: string): string => formatMonthYearLabel(ymd.slice(0, 7));

export const getCardRiskLabel = (
  utilization: number | null,
  isUnrated: boolean,
): { label: string; tone: 'emerald' | 'amber' | 'destructive' | 'muted' } => {
  if (isUnrated) return { label: 'Sin límite', tone: 'muted' };
  if (utilization == null) return { label: 'Sin dato', tone: 'muted' };
  if (utilization > 80) return { label: 'Muy llena', tone: 'destructive' };
  if (utilization > 50) return { label: 'Casi llena', tone: 'amber' };
  return { label: 'Tranquila', tone: 'emerald' };
};

export { formatMonthYearFromYmd };
