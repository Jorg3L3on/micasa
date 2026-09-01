/**
 * Utilidades de calendario para quincenas. Sin Prisma/Node: seguro de importar
 * desde Client Components (`'use client'`).
 *
 * Payday-aligned windows (not civil 1–15 / 16–end):
 * - FIRST of month M: last day of M−1 through the 14th of M
 * - SECOND of month M: the 15th through the penultimate day of M
 * - Last day of M belongs to FIRST of M+1
 */

import { addCalendarDays, todayCalendarDate } from '@/lib/calendar-dates';

export type CalendarFortnightPeriod = 'FIRST' | 'SECOND';

export type CalendarFortnightRef = {
  year: number;
  month: number;
  period: CalendarFortnightPeriod;
};

export type FortnightYmdBounds = {
  startYmd: string;
  endYmd: string;
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

const toYmd = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const parseYmdParts = (
  ymd: string,
): { year: number; month: number; day: number } => {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
};

/** Days in a civil calendar month (1–12), timezone-agnostic. */
export function getDaysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const shiftCalendarMonth = (
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } => {
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return { year: nextYear, month: nextMonth };
};

const lastDayOfPreviousMonthYmd = (year: number, month: number): string => {
  const prev = shiftCalendarMonth(year, month, -1);
  return toYmd(prev.year, prev.month, getDaysInCalendarMonth(prev.year, prev.month));
};

/** Payday-aligned civil YYYY-MM-DD bounds for one named quincena. */
export function getFortnightYmdBounds(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): FortnightYmdBounds {
  if (period === 'FIRST') {
    return {
      startYmd: lastDayOfPreviousMonthYmd(year, month),
      endYmd: toYmd(year, month, 14),
    };
  }

  const penultimate = getDaysInCalendarMonth(year, month) - 1;
  return {
    startYmd: toYmd(year, month, 15),
    endYmd: toYmd(year, month, penultimate),
  };
}

/**
 * Named quincena that contains a civil YYYY-MM-DD.
 * Last day of the month is FIRST of the following month.
 */
export function getCalendarFortnightRefForYmd(ymd: string): CalendarFortnightRef {
  const { year, month, day } = parseYmdParts(ymd);
  const lastDay = getDaysInCalendarMonth(year, month);

  if (day === lastDay) {
    const next = shiftCalendarMonth(year, month, 1);
    return { year: next.year, month: next.month, period: 'FIRST' };
  }

  if (day <= 14) {
    return { year, month, period: 'FIRST' };
  }

  return { year, month, period: 'SECOND' };
}

export function ymdFallsInFortnight(
  ymd: string,
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): boolean {
  const { startYmd, endYmd } = getFortnightYmdBounds(year, month, period);
  return ymd >= startYmd && ymd <= endYmd;
}

/**
 * True when a card/loan due_day occurs as a civil day inside the fortnight.
 * Example: due_day 31 matches June FIRST (May 31–Jun 14), not June SECOND.
 */
export function dueDayFallsInFortnight(
  dueDay: number,
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): boolean {
  return dueYmdInFortnight(dueDay, year, month, period) != null;
}

/** Civil YYYY-MM-DD of `dueDay` inside a named quincena, if it occurs. */
export function dueYmdInFortnight(
  dueDay: number,
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): string | null {
  const { startYmd, endYmd } = getFortnightYmdBounds(year, month, period);
  let cursor = startYmd;
  while (cursor <= endYmd) {
    if (Number(cursor.slice(8, 10)) === dueDay) return cursor;
    cursor = addCalendarDays(cursor, 1);
  }
  return null;
}

/** Today when it sits in the quincena; otherwise the quincena start day. */
export function getDefaultDateForFortnight(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
  todayYmd: string = todayCalendarDate(),
): string {
  if (ymdFallsInFortnight(todayYmd, year, month, period)) return todayYmd;
  return getFortnightYmdBounds(year, month, period).startYmd;
}

/** Inclusive civil-day count between two YYYY-MM-DD strings. */
export function calendarDayCountInclusive(startYmd: string, endYmd: string): number {
  let count = 0;
  let cursor = startYmd;
  while (cursor <= endYmd) {
    count += 1;
    cursor = addCalendarDays(cursor, 1);
  }
  return count;
}

/** Civil Y/M/D in Mexico City for `asOf`. */
export const getCalendarPartsFromDate = (
  asOf: Date = new Date(),
): { year: number; month: number; day: number } => {
  const [year, month, day] = todayCalendarDate(asOf).split('-').map(Number);
  return { year, month, day };
};

/** Calendar fortnight (year, month, period) for `asOf` in Mexico City. */
export function getCurrentCalendarFortnightRef(
  asOf: Date = new Date(),
): CalendarFortnightRef {
  return getCalendarFortnightRefForYmd(todayCalendarDate(asOf));
}

/** Chronological order of calendar fortnights (for comparisons). */
export const compareCalendarFortnight = (
  a: CalendarFortnightRef,
  b: CalendarFortnightRef,
): number => {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  const aPeriod = a.period === 'FIRST' ? 0 : 1;
  const bPeriod = b.period === 'FIRST' ? 0 : 1;
  return aPeriod - bPeriod;
};

/**
 * `true` si (año, mes, period) es la quincena calendario de `asOf`.
 */
export function isCalendarFortnightCurrent(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
  asOf: Date = new Date(),
): boolean {
  const current = getCurrentCalendarFortnightRef(asOf);
  return year === current.year && month === current.month && period === current.period;
}

/**
 * Quincena calendario inmediatamente posterior a la de `asOf`.
 */
export function getNextCalendarFortnight(
  asOf: Date = new Date(),
): CalendarFortnightRef {
  const current = getCurrentCalendarFortnightRef(asOf);

  if (current.period === 'FIRST') {
    return { year: current.year, month: current.month, period: 'SECOND' };
  }

  const next = shiftCalendarMonth(current.year, current.month, 1);
  return { year: next.year, month: next.month, period: 'FIRST' };
}

export function isCalendarFortnightNext(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
  asOf: Date = new Date(),
): boolean {
  const next = getNextCalendarFortnight(asOf);
  return (
    year === next.year && month === next.month && period === next.period
  );
}

/** Default quincena tab when opening a monthly panel for a given calendar month. */
export function getSuggestedFortnightPeriodForMonth(
  year: number,
  month: number,
  asOf: Date = new Date(),
): CalendarFortnightPeriod {
  const current = getCurrentCalendarFortnightRef(asOf);
  if (year > current.year || (year === current.year && month > current.month)) {
    return 'FIRST';
  }
  if (year < current.year || (year === current.year && month < current.month)) {
    return 'SECOND';
  }
  return current.period;
}

/**
 * Sidebar / deep-link to Panel financiero for the current payday-aligned month.
 * On the last civil day of a month this is already next month’s FIRST.
 * Fortnight tab is chosen client-side via `getSuggestedFortnightPeriodForMonth`.
 */
export function getCurrentMonthlyPanelHref(asOf: Date = new Date()): string {
  const { year, month } = getCurrentCalendarFortnightRef(asOf);
  return `/monthly/${year}/${String(month).padStart(2, '0')}`;
}

/**
 * Post-login / “inicio” destination — Panel financiero for the current month.
 * Optional `query` preserves owner context (`ownerType` / `ownerId`) or other params.
 */
export function getAppHomeHref(
  query?: string | URLSearchParams | null,
  asOf: Date = new Date(),
): string {
  const base = getCurrentMonthlyPanelHref(asOf);
  if (!query) return base;
  const qs =
    typeof query === 'string' ? query.replace(/^\?/, '') : query.toString();
  if (!qs) return base;
  return `${base}?${qs}`;
}

const MONTH_NAMES_ES_LOWER = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export type FortnightCalendarBounds = {
  startYmd: string;
  endYmd: string;
  startDay: number;
  endDay: number;
  totalDays: number;
};

export type FortnightPeriodPosition =
  | { kind: 'future' }
  | { kind: 'past' }
  | {
      kind: 'current';
      elapsedPercent: number;
      elapsedDays: number;
      remainingDays: number;
    };

export function getFortnightCalendarBounds(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): FortnightCalendarBounds {
  const { startYmd, endYmd } = getFortnightYmdBounds(year, month, period);
  const start = parseYmdParts(startYmd);
  const end = parseYmdParts(endYmd);
  return {
    startYmd,
    endYmd,
    startDay: start.day,
    endDay: end.day,
    totalDays: calendarDayCountInclusive(startYmd, endYmd),
  };
}

/**
 * Where `todayYmd` (Mexico City `YYYY-MM-DD`) sits relative to a calendar fortnight.
 * Used by monthly chrome progress and budget tone.
 */
export function getFortnightPeriodPosition(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
  todayYmd: string,
): FortnightPeriodPosition {
  const { startYmd, endYmd, totalDays } = getFortnightCalendarBounds(
    year,
    month,
    period,
  );

  if (todayYmd < startYmd) return { kind: 'future' };
  if (todayYmd > endYmd) return { kind: 'past' };

  const elapsedDays = calendarDayCountInclusive(startYmd, todayYmd);
  const remainingDays = calendarDayCountInclusive(todayYmd, endYmd);

  return {
    kind: 'current',
    elapsedPercent: Math.round((elapsedDays / totalDays) * 100),
    elapsedDays,
    remainingDays,
  };
}

/** Spanish civil-day label without year, e.g. `10 de mayo`. */
export function formatDayMonthLabel(
  year: number,
  month: number,
  day: number,
): string {
  const monthName = MONTH_NAMES_ES_LOWER[month - 1] ?? '';
  return `${day} de ${monthName}`;
}

/** Parse `YYYY-MM-DD` and format as `10 de mayo`. */
export function formatDayMonthLabelFromYmd(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return formatDayMonthLabel(year, month, day);
}

/** Spanish range for a named quincena, e.g. `31 de mayo al 14 de junio`. */
export function formatFortnightDateRangeLabel(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): string {
  const { startYmd, endYmd } = getFortnightYmdBounds(year, month, period);
  return `${formatDayMonthLabelFromYmd(startYmd)} al ${formatDayMonthLabelFromYmd(endYmd)}`;
}
