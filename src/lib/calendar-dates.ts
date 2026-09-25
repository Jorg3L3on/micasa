/** Fixed civil-day timezone for MiCasa calendar fields (expenses, incomes, due dates). */
export const APP_TIMEZONE = 'America/Mexico_City';

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarYmdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const displayDateFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const readZonedPart = (parts: Intl.DateTimeFormatPart[], type: string): number =>
  Number(parts.find((part) => part.type === type)?.value ?? 0);

/** Mexico City wall-clock parts for a UTC instant. */
export function formatZonedParts(date: Date): ZonedDateTimeParts {
  const parts = zonedPartsFormatter.formatToParts(date);
  return {
    year: readZonedPart(parts, 'year'),
    month: readZonedPart(parts, 'month'),
    day: readZonedPart(parts, 'day'),
    hour: readZonedPart(parts, 'hour'),
    minute: readZonedPart(parts, 'minute'),
    second: readZonedPart(parts, 'second'),
  };
}

export function isValidCalendarDateString(value: string): boolean {
  if (!CALENDAR_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Civil YYYY-MM-DD for a day-of-month inside `YYYY-MM`.
 * Days past the end of the month clamp to the last civil day.
 */
export function ymdForDayInMonth(monthKey: string, day: number): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match || !Number.isInteger(day) || day < 1) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  const ymd = `${match[1]}-${match[2]}-${String(clamped).padStart(2, '0')}`;
  return isValidCalendarDateString(ymd) ? ymd : null;
}

/**
 * Postgres `DATE` columns come back as UTC midnight. Format with UTC parts so
 * America/Mexico_City does not shift the civil day backward.
 */
export function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD → UTC midnight `Date` for a Postgres `DATE` column.
 * Do not use {@link parseCalendarDate} (UTC noon) for these columns.
 */
export function parseDateOnly(ymd: string): Date {
  if (!isValidCalendarDateString(ymd)) {
    throw new Error(`Invalid calendar date: ${ymd}`);
  }
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** DATE column or YYYY-MM-DD string → civil day, never Mexico City wall time. */
export function formatStoredDateOnly(value: Date | string): string {
  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
    if (match) return match[1]!;
    return formatDateOnly(new Date(value));
  }
  return formatDateOnly(value);
}

/** Parse YYYY-MM-DD → UTC noon on that civil day (stable for UTC−6 display). */
export function parseCalendarDate(ymd: string): Date {
  if (!isValidCalendarDateString(ymd)) {
    throw new Error(`Invalid calendar date: ${ymd}`);
  }
  return new Date(`${ymd}T12:00:00.000Z`);
}

/** Format a DateTime as YYYY-MM-DD in Mexico City. */
export function formatCalendarDate(date: Date): string {
  return calendarYmdFormatter.format(date);
}

/** Current civil day in Mexico City as YYYY-MM-DD. */
export function todayCalendarDate(now: Date = new Date()): string {
  return formatCalendarDate(now);
}

/** Yesterday's civil day in Mexico City as YYYY-MM-DD. */
export function yesterdayCalendarDate(now: Date = new Date()): string {
  return formatCalendarDate(new Date(now.getTime() - 86_400_000));
}

/** Add days to a calendar YYYY-MM-DD string (Mexico City civil days). */
export function addCalendarDays(ymd: string, days: number): string {
  return formatCalendarDate(
    new Date(parseCalendarDate(ymd).getTime() + days * 86_400_000),
  );
}

/** Normalize YYYY-MM-DD or ISO input to stored calendar instant (UTC noon). */
export function coerceToCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid date');
    }
    return parseCalendarDate(formatCalendarDate(value));
  }
  if (CALENDAR_DATE_RE.test(value)) {
    return parseCalendarDate(value);
  }
  const midnightUtcMatch = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/.exec(value);
  if (midnightUtcMatch) {
    return parseCalendarDate(midnightUtcMatch[1]!);
  }
  const noonUtcMatch = /^(\d{4}-\d{2}-\d{2})T12:00:00(?:\.000)?Z$/.exec(value);
  if (noonUtcMatch) {
    return parseCalendarDate(noonUtcMatch[1]!);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parseCalendarDate(formatCalendarDate(parsed));
}

/** Normalize calendar input to midnight in Mexico City (06:00 UTC). */
export function coerceToCalendarDayStart(value: string | Date): Date {
  if (typeof value === 'string' && CALENDAR_DATE_RE.test(value)) {
    return startOfCalendarDay(value);
  }
  return startOfCalendarDay(formatCalendarDate(coerceToCalendarDate(value)));
}

function zonedLocalTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = formatZonedParts(new Date(utcMs));
    const asUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    utcMs += desired - asUtc;
  }
  return new Date(utcMs);
}

/** Inclusive range start: midnight on civil day in Mexico City. */
export function startOfCalendarDay(ymd: string): Date {
  return zonedLocalTimeToUtc(ymd, 0, 0, 0, 0);
}

/** Inclusive range end: last ms on civil day in Mexico City. */
export function endOfCalendarDay(ymd: string): Date {
  return zonedLocalTimeToUtc(ymd, 23, 59, 59, 999);
}

/** es-MX display for calendar dates and timestamps (civil day in MX). */
export function formatDisplayDate(dateString: string | Date): string {
  try {
    const date =
      typeof dateString === 'string'
        ? CALENDAR_DATE_RE.test(dateString)
          ? parseCalendarDate(dateString)
          : new Date(dateString)
        : dateString;
    if (Number.isNaN(date.getTime())) {
      return String(dateString);
    }
    return displayDateFormatter.format(date);
  } catch {
    return String(dateString);
  }
}

const wallClockShortFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});

const wallClockShortWithYearFormatter = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

type WallClockYmd = { year: number; month: number; day: number };

const toDate = (value: string | Date): Date =>
  typeof value === 'string' ? new Date(value) : value;

const readWallClockYmd = (date: Date): WallClockYmd => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
});

const isSameWallClockDay = (a: WallClockYmd, b: WallClockYmd): boolean =>
  a.year === b.year && a.month === b.month && a.day === b.day;

function formatWallClockDateLabel(
  date: Date,
  includeYear: boolean,
): string {
  if (Number.isNaN(date.getTime())) return String(date);
  return includeYear
    ? wallClockShortWithYearFormatter.format(date)
    : wallClockShortFormatter.format(date);
}

/**
 * Compact es-MX label for `@db.Timestamp` wall-clock values. Stored date parts
 * map to UTC components — do not use `formatDisplayDate` (MX instant shift).
 */
export function formatWallClockDateShort(date: string | Date): string {
  const value = toDate(date);
  if (Number.isNaN(value.getTime())) return String(date);
  return wallClockShortFormatter.format(value);
}

/**
 * Wall-clock date range for budget periods. Collapses same-day ranges, hides
 * the year when dates fall in the current Mexico City civil year (rule B).
 */
export function formatWallClockDateRange(
  start: string | Date,
  end: string | Date,
  now: Date = new Date(),
): string {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (Number.isNaN(startDate.getTime())) return String(start);
  if (Number.isNaN(endDate.getTime())) return String(end);

  const startYmd = readWallClockYmd(startDate);
  const endYmd = readWallClockYmd(endDate);
  const currentYear = Number(todayCalendarDate(now).slice(0, 4));

  if (isSameWallClockDay(startYmd, endYmd)) {
    return formatWallClockDateLabel(startDate, startYmd.year !== currentYear);
  }

  if (startYmd.year !== endYmd.year) {
    return `${formatWallClockDateLabel(startDate, true)} – ${formatWallClockDateLabel(endDate, true)}`;
  }

  const showYear = startYmd.year !== currentYear;
  return `${formatWallClockDateLabel(startDate, false)} – ${formatWallClockDateLabel(endDate, showYear)}`;
}
