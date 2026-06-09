import {
  addCalendarDays,
  endOfCalendarDay,
  formatCalendarDate,
  startOfCalendarDay,
} from '@/lib/calendar-dates';
import type { BudgetFrequency } from '@/schemas/budget.schema';
import type { DateRange } from '@/lib/finance/budget-period-spend';

/** Civil YYYY-MM-DD in Mexico City for stored budget timestamps. */
export function readWallClockYmd(date: Date): string {
  return formatCalendarDate(date);
}

function clipWindowToFortnight(window: DateRange, fortnight: DateRange): DateRange {
  return {
    start_date:
      window.start_date > fortnight.start_date ? window.start_date : fortnight.start_date,
    end_date: window.end_date < fortnight.end_date ? window.end_date : fortnight.end_date,
  };
}

function calendarDayRange(ymd: string): DateRange {
  return {
    start_date: startOfCalendarDay(ymd),
    end_date: endOfCalendarDay(ymd),
  };
}

function enumerateCalendarDays(startYmd: string, endYmd: string): string[] {
  const days: string[] = [];
  let cursor = startYmd;
  while (cursor <= endYmd) {
    days.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return days;
}

function calendarWeekStartYmd(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return addCalendarDays(ymd, -dayOfWeek);
}

/** Calendar weeks (Sun–Sat) overlapping a civil-day range. */
export function calendarWeeksOverlappingRange(
  startYmd: string,
  endYmd: string,
): DateRange[] {
  const windows: DateRange[] = [];
  let weekStart = calendarWeekStartYmd(startYmd);

  while (weekStart <= endYmd) {
    const weekEnd = addCalendarDays(weekStart, 6);
    if (weekEnd >= startYmd) {
      windows.push({
        start_date: startOfCalendarDay(weekStart),
        end_date: endOfCalendarDay(weekEnd),
      });
    }
    weekStart = addCalendarDays(weekStart, 7);
  }

  return windows;
}

/**
 * Period windows for recurrent roll-forward inside one fortnight row.
 * DAILY → one period per civil day; WEEKLY → calendar weeks; BIWEEKLY → full fortnight.
 */
export function computeBudgetPeriodWindowsForFortnight(
  frequency: BudgetFrequency,
  fortnight: DateRange,
): DateRange[] {
  const fnStartYmd = readWallClockYmd(fortnight.start_date);
  const fnEndYmd = readWallClockYmd(fortnight.end_date);

  switch (frequency) {
    case 'DAILY':
      return enumerateCalendarDays(fnStartYmd, fnEndYmd).map(calendarDayRange);

    case 'WEEKLY':
      return calendarWeeksOverlappingRange(fnStartYmd, fnEndYmd)
        .map((window) => clipWindowToFortnight(window, fortnight))
        .filter((window) => window.start_date <= window.end_date);

    case 'BIWEEKLY':
      return [
        {
          start_date: fortnight.start_date,
          end_date: fortnight.end_date,
        },
      ];

    case 'CUSTOM':
      return [];
  }
}

/** MX civil fortnight bounds for a calendar month (1–15 and 16–end). */
export function getCalendarFortnightBoundsForMonth(
  year: number,
  month: number,
): { first: DateRange; second: DateRange } {
  const monthStr = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDayStr = String(lastDay).padStart(2, '0');

  return {
    first: {
      start_date: startOfCalendarDay(`${year}-${monthStr}-01`),
      end_date: endOfCalendarDay(`${year}-${monthStr}-15`),
    },
    second: {
      start_date: startOfCalendarDay(`${year}-${monthStr}-16`),
      end_date: endOfCalendarDay(`${year}-${monthStr}-${lastDayStr}`),
    },
  };
}
