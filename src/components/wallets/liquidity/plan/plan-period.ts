import { formatMonthShort, formatMonthTitle } from '@/lib/calendar-dates';
import {
  formatFortnightDateRangeCompact,
  getCalendarFortnightRefForYmd,
} from '@/lib/fortnight-calendar';
import type { PlanHorizon } from '@/lib/finance/cash-plan/types';

/**
 * Period the plan covers, for the hero eyebrow: "Quincena 31 oct–14 nov" or
 * "Mes · Noviembre 2026". Same fortnight rule as `planInputFromLiquidity`:
 * today's quincena in the current month, the first one in any other month.
 */
export const planPeriodLabel = (horizon: PlanHorizon, monthKey: string, asOfYmd: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  if (horizon === 'mes') return `Mes · ${formatMonthTitle(month)} ${year}`;
  const ref = asOfYmd.slice(0, 7) === monthKey
    ? getCalendarFortnightRefForYmd(asOfYmd)
    : { year, month, period: 'FIRST' as const };
  return `Quincena ${formatFortnightDateRangeCompact(ref.year, ref.month, ref.period)}`;
};

/** "Hoy 7 nov" from a civil YYYY-MM-DD. */
export const planTodayLabel = (asOfYmd: string): string => {
  const [, month, day] = asOfYmd.slice(0, 10).split('-').map(Number);
  return `Hoy ${day} ${formatMonthShort(month)}`;
};
