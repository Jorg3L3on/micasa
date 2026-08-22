import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';

export type LiquidityChartRangeId =
  | 'ytd'
  | 'plus_minus_3'
  | 'calendar_year'
  | 'year_and_half';

export const LIQUIDITY_CHART_RANGE_OPTIONS: Array<{
  value: LiquidityChartRangeId;
  label: string;
  hint: string;
}> = [
  { value: 'ytd', label: 'Enero a hoy', hint: 'Lo que va del año' },
  { value: 'plus_minus_3', label: '±3 meses', hint: '3 atrás · 3 adelante' },
  { value: 'calendar_year', label: 'Todo el año', hint: 'Ene – Dic' },
  { value: 'year_and_half', label: 'Año y medio', hint: 'Ene – Jun sig.' },
];

export const compareMonthKeys = (a: string, b: string): number => a.localeCompare(b);

export const monthKeyFromParts = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

export const shiftMonthKey = (monthKey: string, deltaMonths: number): string => {
  let [year, month] = monthKey.split('-').map(Number);
  month += deltaMonths;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return monthKeyFromParts(year, month);
};

export const endOfMonthYmdFromMonthKey = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export const buildMonthKeyRange = (fromMonthKey: string, toMonthKey: string): string[] => {
  let [year, month] = fromMonthKey.split('-').map(Number);
  const [toYear, toMonth] = toMonthKey.split('-').map(Number);
  const months: string[] = [];

  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(monthKeyFromParts(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
};

export type LiquidityChartRangeBounds = {
  fromMonthKey: string;
  toMonthKey: string;
  monthKeys: string[];
};

/** Resolve chart month span from a preset and today's calendar date. */
export const resolveLiquidityChartRange = (
  rangeId: LiquidityChartRangeId,
  todayYmd: string,
): LiquidityChartRangeBounds => {
  const [year] = todayYmd.split('-').map(Number);
  const currentMonthKey = todayYmd.slice(0, 7);
  const yearStart = monthKeyFromParts(year, 1);
  const yearEnd = monthKeyFromParts(year, 12);
  const nextYearMid = monthKeyFromParts(year + 1, 6);

  let fromMonthKey: string;
  let toMonthKey: string;

  switch (rangeId) {
    case 'ytd':
      fromMonthKey = yearStart;
      toMonthKey = currentMonthKey;
      break;
    case 'plus_minus_3':
      fromMonthKey = shiftMonthKey(currentMonthKey, -3);
      toMonthKey = shiftMonthKey(currentMonthKey, 3);
      break;
    case 'calendar_year':
      fromMonthKey = yearStart;
      toMonthKey = yearEnd;
      break;
    case 'year_and_half':
      fromMonthKey = yearStart;
      toMonthKey = nextYearMid;
      break;
    default: {
      const _exhaustive: never = rangeId;
      return _exhaustive;
    }
  }

  return {
    fromMonthKey,
    toMonthKey,
    monthKeys: buildMonthKeyRange(fromMonthKey, toMonthKey),
  };
};

export const monthKeyToUntilDate = (monthKey: string): Date =>
  parseCalendarDate(endOfMonthYmdFromMonthKey(monthKey));

export const isLiquidityChartRangeId = (value: string | null): value is LiquidityChartRangeId =>
  value === 'ytd' ||
  value === 'plus_minus_3' ||
  value === 'calendar_year' ||
  value === 'year_and_half';

export const asOfYmdForMonthKey = (monthKey: string, todayYmd: string): string => {
  const currentMonthKey = todayYmd.slice(0, 7);
  if (monthKey === currentMonthKey) return todayYmd;
  if (compareMonthKeys(monthKey, currentMonthKey) < 0) {
    return endOfMonthYmdFromMonthKey(monthKey);
  }
  return endOfMonthYmdFromMonthKey(monthKey);
};
