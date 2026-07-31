/** Geometry helpers for the login fortnight pulse visualization. */

export const daysInCalendarMonth = (
  year: number,
  month1to12: number,
): number => new Date(Date.UTC(year, month1to12, 0)).getUTCDate();

export const dayToPulseX = (day: number, daysInMonth: number): number =>
  4 + ((day - 1) / Math.max(daysInMonth - 1, 1)) * 292;
