/**
 * Utilidades de calendario para quincenas. Sin Prisma/Node: seguro de importar
 * desde Client Components (`'use client'`).
 */

export type CalendarFortnightPeriod = 'FIRST' | 'SECOND';

export const getFortnightPeriodForDay = (
  day: number,
): CalendarFortnightPeriod => {
  if (day >= 1 && day <= 15) {
    return 'FIRST';
  }
  return 'SECOND';
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
  const y = asOf.getFullYear();
  const m = asOf.getMonth() + 1;
  const d = asOf.getDate();
  const currentPeriod = getFortnightPeriodForDay(d);
  return year === y && month === m && period === currentPeriod;
}
