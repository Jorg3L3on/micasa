import { describe, expect, it } from 'vitest';
import {
  coerceToCalendarDayStart,
  coerceToCalendarDate,
  formatCalendarDate,
  formatChartAxisMonth,
  formatChartMonthRange,
  formatDisplayDate,
  formatDisplayDayMonth,
  formatMonthHeading,
  formatMonthInPhrase,
  formatMonthYearPhrase,
  formatMonthYearTitle,
  formatWallClockDateRange,
  formatWallClockDateShort,
  parseCalendarDate,
  startOfCalendarDay,
  todayCalendarDate,
  yesterdayCalendarDate,
} from '@/lib/calendar-dates';

describe('calendar-dates', () => {
  it('round-trips YYYY-MM-DD via parse and format', () => {
    expect(formatCalendarDate(parseCalendarDate('2026-05-31'))).toBe('2026-05-31');
    expect(formatCalendarDate(parseCalendarDate('2026-01-15'))).toBe('2026-01-15');
  });

  it('stores calendar dates at UTC noon', () => {
    expect(parseCalendarDate('2026-05-31').toISOString()).toBe('2026-05-31T12:00:00.000Z');
  });

  it('formats UTC-midnight stored values to the intended MX civil day', () => {
    expect(formatCalendarDate(new Date('2026-05-31T00:00:00.000Z'))).toBe('2026-05-30');
    expect(formatCalendarDate(new Date('2026-05-31T12:00:00.000Z'))).toBe('2026-05-31');
  });

  it('uses Mexico City civil day for today at local evening', () => {
    // 2026-05-31 22:00 in Mexico City = 2026-06-01 04:00 UTC
    const eveningMx = new Date('2026-06-01T04:00:00.000Z');
    expect(todayCalendarDate(eveningMx)).toBe('2026-05-31');
    expect(yesterdayCalendarDate(eveningMx)).toBe('2026-05-30');
  });

  it('coerces legacy ISO midnight strings to the selected civil day', () => {
    const coerced = coerceToCalendarDate('2026-05-31T00:00:00.000Z');
    expect(coerced.toISOString()).toBe('2026-05-31T12:00:00.000Z');
  });

  it('normalizes payment calendar dates to Mexico City midnight', () => {
    expect(coerceToCalendarDayStart('2026-06-04').toISOString()).toBe(
      '2026-06-04T06:00:00.000Z',
    );
  });

  it('startOfCalendarDay aligns to MX midnight', () => {
    const start = startOfCalendarDay('2026-05-31');
    expect(formatCalendarDate(start)).toBe('2026-05-31');
    expect(start.getUTCHours()).toBe(6);
  });

  it('formatDisplayDate renders es-MX civil day and hides the current year', () => {
    const now = new Date('2026-09-28T18:00:00.000Z');
    expect(formatDisplayDate('2026-05-31', now)).toMatch(/31/);
    expect(formatDisplayDate('2026-05-31', now)).not.toMatch(/2026/);
    expect(formatDisplayDate('2025-05-31', now)).toMatch(/2025/);
    expect(formatDisplayDate(parseCalendarDate('2026-05-31'), now)).toMatch(/31/);
  });

  it('formats month titles, phrases, and chart axes with one year rule', () => {
    const now = new Date('2026-09-28T18:00:00.000Z');
    expect(formatMonthHeading(11, 2026, now)).toBe('Noviembre');
    expect(formatMonthHeading(11, 2025, now)).toBe('Noviembre 2025');
    expect(formatMonthInPhrase(11, 2026, now)).toBe('noviembre');
    expect(formatMonthInPhrase(11, 2025, now)).toBe('noviembre 2025');
    expect(formatMonthYearTitle('2026-11', now)).toBe('Noviembre');
    expect(formatMonthYearTitle('2025-11', now)).toBe('Noviembre de 2025');
    expect(formatMonthYearPhrase('2025-11', now)).toBe('noviembre de 2025');
    expect(formatChartAxisMonth('2026-09', now)).toBe('sep');
    expect(formatChartAxisMonth('2025-09', now)).toBe('sep 25');
    expect(formatChartMonthRange('2026-07', '2026-09', now)).toBe('jul – sep');
    expect(formatChartMonthRange('2025-12', '2026-01', now)).toBe('dic 25 – ene 26');
  });

  it('formatDisplayDayMonth omits the year', () => {
    expect(formatDisplayDayMonth('2026-10-01')).toBe('1 oct');
    expect(formatDisplayDayMonth(parseCalendarDate('2026-10-01'))).not.toMatch(/2026/);
  });

  it('formatWallClockDateShort keeps stored timestamp date parts', () => {
    expect(formatWallClockDateShort('2026-06-01T00:00:00.000Z')).toMatch(/1.*jun/i);
    expect(formatWallClockDateShort('2026-06-15T00:00:00.000Z')).toMatch(/15.*jun/i);
  });

  it('formatWallClockDateRange shows budget fortnight without MX shift', () => {
    const now = new Date('2026-06-07T18:00:00.000Z');
    const range = formatWallClockDateRange(
      '2026-06-01T00:00:00.000Z',
      '2026-06-15T00:00:00.000Z',
      now,
    );
    expect(range).toMatch(/1.*jun/i);
    expect(range).toMatch(/15.*jun/i);
    expect(range).not.toMatch(/31.*may/i);
    expect(range).not.toMatch(/14.*jun/i);
    expect(range).not.toMatch(/2026/);
  });

  it('formatWallClockDateRange collapses same-day periods', () => {
    const now = new Date('2026-06-07T18:00:00.000Z');
    expect(
      formatWallClockDateRange(
        '2026-06-07T00:00:00.000Z',
        '2026-06-07T23:59:59.999Z',
        now,
      ),
    ).toMatch(/^7.*jun(?!.*–).*$/i);
  });

  it('formatWallClockDateRange appends year for non-current civil years', () => {
    const now = new Date('2026-06-07T18:00:00.000Z');
    expect(
      formatWallClockDateRange(
        '2025-06-01T00:00:00.000Z',
        '2025-06-15T00:00:00.000Z',
        now,
      ),
    ).toMatch(/1.*jun.*–.*15.*jun.*2025/i);
    expect(
      formatWallClockDateRange('2025-06-07T00:00:00.000Z', '2025-06-07T23:59:59.999Z', now),
    ).toMatch(/7.*jun.*2025/i);
  });

  it('formatWallClockDateRange shows both years when range crosses years', () => {
    const now = new Date('2026-06-07T18:00:00.000Z');
    const range = formatWallClockDateRange(
      '2025-12-28T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
      now,
    );
    expect(range).toMatch(/28.*dic.*2025/i);
    expect(range).toMatch(/3.*ene.*2026/i);
  });
});
