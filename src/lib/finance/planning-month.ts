import { todayCalendarDate } from '@/lib/calendar-dates';

/** Matches the create-month API year bound. */
export const PLANNING_MONTH_MAX_YEAR = 2030;

/** Null when the month can be created. Past months stay blocked. */
export const planningMonthCreateError = (
  year: number,
  month: number,
  now: Date = new Date(),
): string | null => {
  const today = todayCalendarDate(now);
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  if (year > PLANNING_MONTH_MAX_YEAR) {
    return `Solo se pueden crear meses hasta ${PLANNING_MONTH_MAX_YEAR}`;
  }
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'No se pueden crear meses ya pasados. Solo el mes actual o futuros.';
  }
  return null;
};
