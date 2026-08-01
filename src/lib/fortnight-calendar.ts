/**
 * Utilidades de calendario para quincenas. Sin Prisma/Node: seguro de importar
 * desde Client Components (`'use client'`).
 */

import { todayCalendarDate } from '@/lib/calendar-dates';

export type CalendarFortnightPeriod = 'FIRST' | 'SECOND';

export type CalendarFortnightRef = {
  year: number;
  month: number;
  period: CalendarFortnightPeriod;
};

export const getFortnightPeriodForDay = (
  day: number,
): CalendarFortnightPeriod => {
  if (day >= 1 && day <= 15) {
    return 'FIRST';
  }
  return 'SECOND';
};

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
  const { year, month, day } = getCalendarPartsFromDate(asOf);
  return { year, month, period: getFortnightPeriodForDay(day) };
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
 * `true` si (año, mes, period) es la quincena calendario de `asOf` (mismo mes/año
 * y periodo según el día: 1–15 = FIRST, 16+ = SECOND).
 */
export function isCalendarFortnightCurrent(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
  asOf: Date = new Date(),
): boolean {
  const { year: y, month: m, day: d } = getCalendarPartsFromDate(asOf);
  const currentPeriod = getFortnightPeriodForDay(d);
  return year === y && month === m && period === currentPeriod;
}

/**
 * Quincena calendario inmediatamente posterior a la de `asOf`
 * (misma segunda mitad si estamos en la primera; si estamos en la segunda,
 * la primera del mes siguiente).
 */
export function getNextCalendarFortnight(
  asOf: Date = new Date(),
): CalendarFortnightRef {
  const { year: y, month: m, day: d } = getCalendarPartsFromDate(asOf);
  const currentPeriod = getFortnightPeriodForDay(d);

  if (currentPeriod === 'FIRST') {
    return { year: y, month: m, period: 'SECOND' };
  }

  let nextMonth = m + 1;
  let nextYear = y;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth, period: 'FIRST' };
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
  const { year: y, month: m, day: d } = getCalendarPartsFromDate(asOf);
  if (year > y || (year === y && month > m)) {
    return 'FIRST';
  }
  if (year < y || (year === y && month < m)) {
    return 'SECOND';
  }
  return getFortnightPeriodForDay(d);
}

/**
 * Sidebar / deep-link to Panel financiero for the current Mexico City month.
 * Fortnight tab is chosen client-side via `getSuggestedFortnightPeriodForMonth`.
 */
export function getCurrentMonthlyPanelHref(asOf: Date = new Date()): string {
  const { year, month } = getCurrentCalendarFortnightRef(asOf);
  return `/monthly/${year}/${String(month).padStart(2, '0')}`;
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

/** Days in a civil calendar month (1–12), timezone-agnostic. */
export function getDaysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getFortnightCalendarBounds(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): FortnightCalendarBounds {
  const startDay = period === 'FIRST' ? 1 : 16;
  const endDay = period === 'FIRST' ? 15 : getDaysInCalendarMonth(year, month);
  return {
    startDay,
    endDay,
    totalDays: endDay - startDay + 1,
  };
}

function toYmdKey(year: number, month: number, day: number): number {
  return year * 10_000 + month * 100 + day;
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
  const { startDay, endDay, totalDays } = getFortnightCalendarBounds(
    year,
    month,
    period,
  );
  const todayKey = Number(todayYmd.replaceAll('-', ''));
  const startKey = toYmdKey(year, month, startDay);
  const endKey = toYmdKey(year, month, endDay);

  if (todayKey < startKey) return { kind: 'future' };
  if (todayKey > endKey) return { kind: 'past' };

  const todayDay = Number(todayYmd.slice(8, 10));
  const elapsedDays = Math.min(Math.max(todayDay - startDay + 1, 1), totalDays);
  const remainingDays = Math.max(endDay - todayDay + 1, 0);

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
