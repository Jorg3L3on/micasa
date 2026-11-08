import { describe, expect, it } from 'vitest';
import {
  formatDayMonth,
  formatMonthYear,
  parseCalendarDate,
} from '@/lib/calendar-dates';

describe('formatMonthYear', () => {
  it('always includes the year', () => {
    expect(formatMonthYear('2027-06-01')).toBe('jun 2027');
    expect(formatMonthYear('2026-12-31')).toBe('dic 2026');
  });

  it('reads stored instants in America/Mexico_City', () => {
    // 2027-01-01 03:00 UTC is still 31 Dec 2026 in Mexico City.
    expect(formatMonthYear(new Date('2027-01-01T03:00:00.000Z'))).toBe('dic 2026');
    expect(formatMonthYear(parseCalendarDate('2027-01-01'))).toBe('ene 2027');
  });
});

describe('formatDayMonth', () => {
  const now = new Date('2026-11-07T18:00:00.000Z');

  it('hides the current year and shows any other', () => {
    expect(formatDayMonth('2026-11-16', { now })).toBe('16 nov');
    expect(formatDayMonth('2027-01-01', { now })).toBe('1 ene 2027');
    expect(formatDayMonth('2025-12-16', { now })).toBe('16 dic 2025');
  });

  it('can always omit the year', () => {
    expect(formatDayMonth('2027-01-01', { now, yearIfNotCurrent: false })).toBe('1 ene');
  });

  it('uses the Mexico City civil day for instants', () => {
    expect(formatDayMonth(new Date('2027-01-01T03:00:00.000Z'), { now })).toBe('31 dic');
  });
});
