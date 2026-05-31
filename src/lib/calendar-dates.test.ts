import { describe, expect, it } from 'vitest';
import {
  coerceToCalendarDate,
  formatCalendarDate,
  formatDisplayDate,
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

  it('startOfCalendarDay aligns to MX midnight', () => {
    const start = startOfCalendarDay('2026-05-31');
    expect(formatCalendarDate(start)).toBe('2026-05-31');
    expect(start.getUTCHours()).toBe(6);
  });

  it('formatDisplayDate renders es-MX civil day', () => {
    expect(formatDisplayDate('2026-05-31')).toMatch(/31/);
    expect(formatDisplayDate(parseCalendarDate('2026-05-31'))).toMatch(/31/);
  });
});
