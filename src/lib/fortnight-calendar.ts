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
