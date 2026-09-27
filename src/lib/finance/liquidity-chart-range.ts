import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';

export type LiquidityChartRangeId = 'next_3' | 'next_6' | 'next_12' | 'payoff' | 'custom';

export type LiquidityChartPresetId = Exclude<LiquidityChartRangeId, 'custom'>;

export type LiquidityCustomChartRange = {
  fromMonthKey: string;
  toMonthKey: string;
};

export const DEFAULT_LIQUIDITY_CHART_RANGE: LiquidityChartPresetId = 'next_3';

export const LIQUIDITY_CHART_RANGE_OPTIONS: Array<{
  value: LiquidityChartPresetId;
  label: string;
  description: string;
}> = [
  { value: 'next_3', label: '3M', description: 'Próximos 3 meses' },
  { value: 'next_6', label: '6M', description: 'Próximos 6 meses' },
  { value: 'next_12', label: '1A', description: 'Próximos 12 meses' },
  { value: 'payoff', label: 'Hasta liquidar', description: 'Hasta que terminas de pagar' },
];

/** Shortest "Hasta liquidar" window, so a payoff this month still draws a line. */
const PAYOFF_MIN_MONTHS = 3;
/** "Hasta liquidar" window when there is no debt left to pay. */
const PAYOFF_FALLBACK_MONTHS = 6;
/** The projection must cover at least the "1A" preset. */
const FETCH_MIN_FORWARD_MONTHS = 11;

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: string | null | undefined): value is string =>
  Boolean(value && MONTH_KEY_PATTERN.test(value));

export const normalizeCustomChartRange = (
  fromMonthKey: string,
  toMonthKey: string,
): LiquidityCustomChartRange => {
  if (compareMonthKeys(fromMonthKey, toMonthKey) <= 0) {
    return { fromMonthKey, toMonthKey };
  }
  return { fromMonthKey: toMonthKey, toMonthKey: fromMonthKey };
};

export const parseStoredCustomChartRange = (
  raw: string | null,
): LiquidityCustomChartRange | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
    const fromMonthKey = typeof parsed.from === 'string' ? parsed.from : null;
    const toMonthKey = typeof parsed.to === 'string' ? parsed.to : null;
    if (!isMonthKey(fromMonthKey) || !isMonthKey(toMonthKey)) return null;
    return normalizeCustomChartRange(fromMonthKey, toMonthKey);
  } catch {
    return null;
  }
};

export const clampCustomChartRangeToAvailable = (
  range: LiquidityCustomChartRange,
  availableMonthKeys: readonly string[],
): LiquidityCustomChartRange => {
  if (availableMonthKeys.length === 0) return range;
  const sorted = [...availableMonthKeys].filter(isMonthKey).sort(compareMonthKeys);
  if (sorted.length === 0) return range;
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const fromMonthKey = sorted.includes(range.fromMonthKey) ? range.fromMonthKey : first;
  const toMonthKey = sorted.includes(range.toMonthKey) ? range.toMonthKey : last;
  return normalizeCustomChartRange(fromMonthKey, toMonthKey);
};

export const defaultCustomChartRange = (
  asOfYmd: string,
  availableMonthKeys: readonly string[] = [],
): LiquidityCustomChartRange => {
  const currentMonthKey = asOfYmd.slice(0, 7);
  const sorted = [...availableMonthKeys].filter(isMonthKey).sort(compareMonthKeys);
  const fromMonthKey = sorted.includes(currentMonthKey) ? currentMonthKey : (sorted[0] ?? currentMonthKey);
  const targetTo = shiftMonthKey(fromMonthKey, 2);
  const toMonthKey = sorted.includes(targetTo)
    ? targetTo
    : (sorted[sorted.length - 1] ?? targetTo);
  return normalizeCustomChartRange(fromMonthKey, toMonthKey);
};

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

/** Last month with a scheduled debt payment, or null when nothing is left to pay. */
export const resolveDebtPayoffMonthKey = (
  months: ReadonlyArray<{ monthKey: string; paymentsDue: number }>,
): string | null => {
  let payoffMonthKey: string | null = null;
  for (const month of months) {
    if (month.paymentsDue <= 0.005) continue;
    if (!payoffMonthKey || compareMonthKeys(month.monthKey, payoffMonthKey) > 0) {
      payoffMonthKey = month.monthKey;
    }
  }
  return payoffMonthKey;
};

const resolvePayoffToMonthKey = (
  currentMonthKey: string,
  payoffMonthKey: string | null,
): string => {
  if (!payoffMonthKey) return shiftMonthKey(currentMonthKey, PAYOFF_FALLBACK_MONTHS - 1);
  const minimumTo = shiftMonthKey(currentMonthKey, PAYOFF_MIN_MONTHS - 1);
  return compareMonthKeys(payoffMonthKey, minimumTo) > 0 ? payoffMonthKey : minimumTo;
};

/** Resolve chart month span from a preset (or custom from/to) and today's calendar date. */
export const resolveLiquidityChartRange = (
  rangeId: LiquidityChartRangeId,
  todayYmd: string,
  custom: LiquidityCustomChartRange | null = null,
  payoffMonthKey: string | null = null,
): LiquidityChartRangeBounds => {
  const currentMonthKey = todayYmd.slice(0, 7);

  let fromMonthKey: string;
  let toMonthKey: string;

  switch (rangeId) {
    case 'next_3':
      fromMonthKey = currentMonthKey;
      toMonthKey = shiftMonthKey(currentMonthKey, 2);
      break;
    case 'next_6':
      fromMonthKey = currentMonthKey;
      toMonthKey = shiftMonthKey(currentMonthKey, 5);
      break;
    case 'next_12':
      fromMonthKey = currentMonthKey;
      toMonthKey = shiftMonthKey(currentMonthKey, 11);
      break;
    case 'payoff':
      fromMonthKey = currentMonthKey;
      toMonthKey = resolvePayoffToMonthKey(currentMonthKey, payoffMonthKey);
      break;
    case 'custom': {
      const resolved = custom
        ? normalizeCustomChartRange(custom.fromMonthKey, custom.toMonthKey)
        : defaultCustomChartRange(todayYmd);
      fromMonthKey = resolved.fromMonthKey;
      toMonthKey = resolved.toMonthKey;
      break;
    }
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

/**
 * Months the projection API computes: January of this year (so the range slider can look
 * back) through June of next year, extended so the "1A" preset is always fully covered.
 */
export const resolveLiquidityFetchWindow = (
  todayYmd: string,
): { fromMonthKey: string; toMonthKey: string } => {
  const [year] = todayYmd.split('-').map(Number);
  const currentMonthKey = todayYmd.slice(0, 7);
  const nextYearMid = monthKeyFromParts(year + 1, 6);
  const minimumTo = shiftMonthKey(currentMonthKey, FETCH_MIN_FORWARD_MONTHS);
  return {
    fromMonthKey: monthKeyFromParts(year, 1),
    toMonthKey: compareMonthKeys(nextYearMid, minimumTo) >= 0 ? nextYearMid : minimumTo,
  };
};

export const isLiquidityChartRangeId = (value: string | null): value is LiquidityChartRangeId =>
  value === 'next_3' ||
  value === 'next_6' ||
  value === 'next_12' ||
  value === 'payoff' ||
  value === 'custom';

export const asOfYmdForMonthKey = (monthKey: string, todayYmd: string): string => {
  const currentMonthKey = todayYmd.slice(0, 7);
  if (monthKey === currentMonthKey) return todayYmd;
  if (compareMonthKeys(monthKey, currentMonthKey) < 0) {
    return endOfMonthYmdFromMonthKey(monthKey);
  }
  return endOfMonthYmdFromMonthKey(monthKey);
};
