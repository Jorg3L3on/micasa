import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
} from '@/types/catalog';

/**
 * Gastos programados and Ingresos programados share one kit (MIC-I16).
 * Both list responses are mapped to `ScheduledItem`, and every figure, order
 * and label the screens show comes from the pure functions below.
 *
 * Rules:
 * - An item repeats when it applies to at least one quincena. That is what
 *   template expansion reads (`applies_*_fortnight`); the legacy
 *   `is_recurring` flag does not change what a quincena gets, so it is ignored.
 * - Only active items that repeat count in totals.
 * - An item with no amount is "variable": it adds to `variableCount`, never 0
 *   to a total.
 * - Day 15 belongs to the 2ª quincena: valid due days are 1-14 for the 1ª and
 *   15-30 for the 2ª.
 */

export type ScheduledKind = 'expense' | 'income';
export type ScheduledPeriod = 'FIRST' | 'SECOND';
export type ScheduledView = 'all' | 'first' | 'second';

export type ScheduledItem = {
  id: number;
  kind: ScheduledKind;
  name: string;
  /** Amount per occurrence; null = variable. */
  amount: number | null;
  active: boolean;
  appliesFirst: boolean;
  appliesSecond: boolean;
  /** Due day used in the 1ª quincena, legacy `due_day` included; null = no fixed day. */
  dueDayFirst: number | null;
  /** Due day used in the 2ª quincena, legacy `due_day` included; null = no fixed day. */
  dueDaySecond: number | null;
  isSubscription: boolean;
};

const PERIODS: readonly ScheduledPeriod[] = ['FIRST', 'SECOND'];

const PERIOD_SHORT: Record<ScheduledPeriod, string> = {
  FIRST: '1ª',
  SECOND: '2ª',
};

export const DUE_DAY_RANGE: Record<ScheduledPeriod, { min: number; max: number }> = {
  FIRST: { min: 1, max: 14 },
  SECOND: { min: 15, max: 30 },
};

const amountOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Expense list item → normalised shape. Reads `suggestedAmount` only:
 * `totalEstimatedAmount` sums joined expenses and stays for compatibility.
 * A row saved before per-quincena days keeps its legacy `due_day` in `dueDay`
 * with both specific days empty; that day then applies to both quincenas,
 * as `resolveTemplateDueDay` does when a quincena is expanded.
 */
export const fromExpenseTemplate = (
  item: ExpenseTemplateListItem,
): ScheduledItem => {
  const legacyOnly =
    item.dueDayFirst == null && item.dueDaySecond == null ? item.dueDay : null;
  return {
    id: item.id,
    kind: 'expense',
    name: item.name,
    amount: amountOrNull(item.suggestedAmount),
    active: item.active,
    appliesFirst: item.appliesFirstFortnight,
    appliesSecond: item.appliesSecondFortnight,
    dueDayFirst: item.dueDayFirst ?? legacyOnly ?? null,
    dueDaySecond: item.dueDaySecond ?? legacyOnly ?? null,
    isSubscription: item.isSubscription,
  };
};

/** Income list item → normalised shape. Incomes have no due day. */
export const fromIncomeTemplate = (
  item: IncomeTemplateListItem,
): ScheduledItem => ({
  id: item.id,
  kind: 'income',
  name: item.name,
  amount: amountOrNull(item.suggestedAmount),
  active: item.active,
  appliesFirst: item.appliesFirstFortnight,
  appliesSecond: item.appliesSecondFortnight,
  dueDayFirst: null,
  dueDaySecond: null,
  isSubscription: false,
});

export const appliesTo = (item: ScheduledItem, period: ScheduledPeriod): boolean =>
  period === 'FIRST' ? item.appliesFirst : item.appliesSecond;

export const repeats = (item: ScheduledItem): boolean =>
  item.appliesFirst || item.appliesSecond;

/** Due day in that quincena, or null when it has none or does not apply there. */
export const dueDayIn = (
  item: ScheduledItem,
  period: ScheduledPeriod,
): number | null => {
  if (!appliesTo(item, period)) return null;
  return period === 'FIRST' ? item.dueDayFirst : item.dueDaySecond;
};

/** How many quincenas a month the item occurs in: 0, 1 or 2. */
const occurrencesPerMonth = (item: ScheduledItem): number =>
  (item.appliesFirst ? 1 : 0) + (item.appliesSecond ? 1 : 0);

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (cents: number): number => cents / 100;

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type PeriodSummary = {
  /** Sum of the known amounts. */
  total: number;
  /** Active items that occur in this quincena, variable ones included. */
  count: number;
  /** Of `count`, how many have no amount. */
  variableCount: number;
};

export type ScheduledSummary = {
  first: PeriodSummary;
  second: PeriodSummary;
  /** 1ª + 2ª. */
  monthTotal: number;
  /** Distinct active items with no amount that occur at least once a month. */
  monthVariableCount: number;
  /** Monthly cost of active subscriptions with an amount; 0 for incomes. */
  subscriptionsMonthTotal: number;
};

const counts = (item: ScheduledItem): boolean => item.active && repeats(item);

export const summarize = (items: readonly ScheduledItem[]): ScheduledSummary => {
  const cents = { FIRST: 0, SECOND: 0 };
  const count = { FIRST: 0, SECOND: 0 };
  const variable = { FIRST: 0, SECOND: 0 };
  let monthVariableCount = 0;
  let subscriptionCents = 0;

  for (const item of items) {
    if (!counts(item)) continue;
    if (item.amount === null) monthVariableCount += 1;
    for (const period of PERIODS) {
      if (!appliesTo(item, period)) continue;
      count[period] += 1;
      if (item.amount === null) {
        variable[period] += 1;
      } else {
        cents[period] += toCents(item.amount);
        if (item.isSubscription) subscriptionCents += toCents(item.amount);
      }
    }
  }

  return {
    first: {
      total: fromCents(cents.FIRST),
      count: count.FIRST,
      variableCount: variable.FIRST,
    },
    second: {
      total: fromCents(cents.SECOND),
      count: count.SECOND,
      variableCount: variable.SECOND,
    },
    monthTotal: fromCents(cents.FIRST + cents.SECOND),
    monthVariableCount,
    subscriptionsMonthTotal: fromCents(subscriptionCents),
  };
};

/** "Queda tras gastos" per quincena: income total minus expense total. */
export type NetByPeriod = { first: number; second: number };

/**
 * Income summary minus the same owner's expense summary, per quincena, both
 * from `summarize`. Null when the expense list did not load: the cell is
 * omitted then, never shown as if there were no gastos.
 */
export const netAfterExpenses = (
  income: ScheduledSummary,
  expense: ScheduledSummary | null,
): NetByPeriod | null => {
  if (!expense) return null;
  return {
    first: fromCents(toCents(income.first.total) - toCents(expense.first.total)),
    second: fromCents(toCents(income.second.total) - toCents(expense.second.total)),
  };
};

// ---------------------------------------------------------------------------
// Sections and order
// ---------------------------------------------------------------------------

export type ScheduledSections = {
  /** Active items that occur in the view, ordered by due day. */
  programados: ScheduledItem[];
  /** Active items in no quincena. Only in the `all` view. */
  sinProgramar: ScheduledItem[];
  /** Inactive items; in a quincena view only those that would occur in it. */
  inactivos: ScheduledItem[];
};

const nameCollator = new Intl.Collator('es-MX', { sensitivity: 'base', numeric: true });

const byName = (a: ScheduledItem, b: ScheduledItem): number =>
  nameCollator.compare(a.name, b.name) || a.id - b.id;

/**
 * Sort key for a view: the day inside that quincena, or in `all` the first
 * (smallest) day among the quincenas the item occurs in.
 */
export const sortDay = (item: ScheduledItem, view: ScheduledView): number | null => {
  if (view === 'first') return dueDayIn(item, 'FIRST');
  if (view === 'second') return dueDayIn(item, 'SECOND');
  const days = PERIODS.map((p) => dueDayIn(item, p)).filter(
    (d): d is number => d !== null,
  );
  return days.length > 0 ? Math.min(...days) : null;
};

/** By due day; ties by name; items with no day last, by name. */
export const compareByDueDay =
  (view: ScheduledView) =>
  (a: ScheduledItem, b: ScheduledItem): number => {
    const da = sortDay(a, view);
    const db = sortDay(b, view);
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    }
    return byName(a, b);
  };

const inView = (item: ScheduledItem, view: ScheduledView): boolean => {
  if (view === 'first') return item.appliesFirst;
  if (view === 'second') return item.appliesSecond;
  return true;
};

export const sectionize = (
  items: readonly ScheduledItem[],
  view: ScheduledView,
): ScheduledSections => {
  const programados: ScheduledItem[] = [];
  const sinProgramar: ScheduledItem[] = [];
  const inactivos: ScheduledItem[] = [];

  for (const item of items) {
    if (!inView(item, view)) continue;
    if (!item.active) inactivos.push(item);
    else if (repeats(item)) programados.push(item);
    else sinProgramar.push(item);
  }

  return {
    programados: programados.sort(compareByDueDay(view)),
    sinProgramar: sinProgramar.sort(byName),
    inactivos: inactivos.sort(byName),
  };
};

// ---------------------------------------------------------------------------
// Labels and figures
// ---------------------------------------------------------------------------

/** "1ª · día 12", "2ª", or null when the item does not occur in that quincena. */
export const scheduleLabel = (
  item: ScheduledItem,
  period: ScheduledPeriod,
): string | null => {
  if (!appliesTo(item, period)) return null;
  const day = dueDayIn(item, period);
  return day === null ? PERIOD_SHORT[period] : `${PERIOD_SHORT[period]} · día ${day}`;
};

/** One label per quincena the item occurs in, 1ª first; empty when none. */
export const scheduleLabels = (item: ScheduledItem): string[] =>
  PERIODS.map((p) => scheduleLabel(item, p)).filter(
    (label): label is string => label !== null,
  );

/** Amount per month; null when variable or when the item does not repeat. */
export const perMonth = (item: ScheduledItem): number | null => {
  if (item.amount === null || !repeats(item)) return null;
  return fromCents(toCents(item.amount) * occurrencesPerMonth(item));
};

/** `perMonth` × 12; null in the same cases. */
export const perYear = (item: ScheduledItem): number | null => {
  const month = perMonth(item);
  return month === null ? null : fromCents(toCents(month) * 12);
};

// ---------------------------------------------------------------------------
// Due-day options
// ---------------------------------------------------------------------------

export type DayOption = { value: number | null; label: string };

export const NO_FIXED_DAY_LABEL = 'Sin día fijo';

/** "Sin día fijo", then every valid day of the quincena (1ª 1-14, 2ª 15-30). */
export const dayOptions = (period: ScheduledPeriod): DayOption[] => {
  const { min, max } = DUE_DAY_RANGE[period];
  const days: DayOption[] = [];
  for (let day = min; day <= max; day += 1) {
    days.push({ value: day, label: `Día ${day}` });
  }
  return [{ value: null, label: NO_FIXED_DAY_LABEL }, ...days];
};

export const isValidDueDay = (period: ScheduledPeriod, day: number): boolean => {
  const { min, max } = DUE_DAY_RANGE[period];
  return Number.isInteger(day) && day >= min && day <= max;
};

/**
 * Closest valid day for a stored value (legacy rows may hold 15 in the 1ª or
 * 31 in the 2ª). Null stays null.
 */
export const nearestValidDueDay = (
  period: ScheduledPeriod,
  day: number | null,
): number | null => {
  if (day === null || !Number.isFinite(day)) return null;
  const { min, max } = DUE_DAY_RANGE[period];
  return Math.min(max, Math.max(min, Math.round(day)));
};
