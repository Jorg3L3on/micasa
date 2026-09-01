import {
  addCalendarDays,
  endOfCalendarDay,
  formatCalendarDate,
  parseCalendarDate,
  startOfCalendarDay,
} from '@/lib/calendar-dates';
import {
  getFortnightYmdBounds,
  type CalendarFortnightPeriod,
} from '@/lib/fortnight-calendar';
import type { BudgetFrequency } from '@/schemas/budget.schema';
import type { DateRange } from '@/lib/finance/budget-period-spend';

/** Civil YYYY-MM-DD in Mexico City for stored budget timestamps. */
export function readWallClockYmd(date: Date): string {
  return formatCalendarDate(date);
}

function calendarDayRange(ymd: string): DateRange {
  const day = parseCalendarDate(ymd);
  return {
    start_date: day,
    end_date: day,
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
      // Store as UTC noon so PG `timestamp` round-trips keep civil days stable.
      windows.push({
        start_date: parseCalendarDate(weekStart),
        end_date: parseCalendarDate(weekEnd),
      });
    }
    weekStart = addCalendarDays(weekStart, 7);
  }

  return windows;
}

/**
 * Period windows for recurrent roll-forward inside one fortnight row.
 * DAILY → one period per civil day; WEEKLY → full Sun–Sat weeks (not clipped);
 * BIWEEKLY → full fortnight.
 *
 * WEEKLY periods are stored as full calendar weeks so panel day-proration uses
 * a 7-day denominator. Clipping stubs to the fortnight made ratio=1 and, with
 * timezone-unsafe encodings, produced 8-day “weeks” that bled across quincenas.
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
      return calendarWeeksOverlappingRange(fnStartYmd, fnEndYmd);

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

/** Payday-aligned fortnight bounds for a named month (query-inclusive encoding). */
export function getCalendarFortnightBoundsForMonth(
  year: number,
  month: number,
): { first: DateRange; second: DateRange } {
  const first = getFortnightYmdBounds(year, month, 'FIRST');
  const second = getFortnightYmdBounds(year, month, 'SECOND');

  return {
    first: {
      start_date: startOfCalendarDay(first.startYmd),
      end_date: endOfCalendarDay(first.endYmd),
    },
    second: {
      start_date: startOfCalendarDay(second.startYmd),
      end_date: endOfCalendarDay(second.endYmd),
    },
  };
}

/**
 * Canonical civil-day bounds for one fortnight, stored as UTC noon
 * (`parseCalendarDate`) so PostgreSQL `timestamp` round-trips keep the same
 * Mexico City calendar day. Prefer this for Fortnight / BudgetPeriod rows.
 * Use `getCalendarFortnightBoundsForMonth` for inclusive query scopes.
 *
 * FIRST: last day of previous month through the 14th.
 * SECOND: the 15th through the penultimate day.
 */
export function getCanonicalFortnightBounds(
  year: number,
  month: number,
  period: CalendarFortnightPeriod,
): DateRange {
  const { startYmd, endYmd } = getFortnightYmdBounds(year, month, period);
  return {
    start_date: parseCalendarDate(startYmd),
    end_date: parseCalendarDate(endYmd),
  };
}

/** True when period civil days match the window (ignores time-of-day encoding). */
export function periodMatchesCalendarWindow(
  period: DateRange,
  window: DateRange,
): boolean {
  return (
    readWallClockYmd(period.start_date) === readWallClockYmd(window.start_date) &&
    readWallClockYmd(period.end_date) === readWallClockYmd(window.end_date)
  );
}

/**
 * Snap a WEEKLY period onto the Sun–Sat week that contains its end day.
 * Fixes 8-day artifacts from timezone-unsafe startOf/endOf encodings and
 * clipped stubs so day-proration uses a 7-day denominator.
 */
export function canonicalizeWeeklyPeriod(period: DateRange): DateRange {
  const endYmd = readWallClockYmd(period.end_date);
  const weekStart = calendarWeekStartYmd(endYmd);
  const weekEnd = addCalendarDays(weekStart, 6);
  return {
    start_date: parseCalendarDate(weekStart),
    end_date: parseCalendarDate(weekEnd),
  };
}

/** Rewrite a single civil day with UTC-noon encoding (DAILY periods). */
export function canonicalizeDailyPeriod(period: DateRange): DateRange {
  const ymd = readWallClockYmd(period.start_date);
  const day = parseCalendarDate(ymd);
  return { start_date: day, end_date: day };
}

/** Rewrite an arbitrary range's endpoints with UTC-noon encoding (CUSTOM). */
export function canonicalizeCustomPeriod(period: DateRange): DateRange {
  return {
    start_date: parseCalendarDate(readWallClockYmd(period.start_date)),
    end_date: parseCalendarDate(readWallClockYmd(period.end_date)),
  };
}
