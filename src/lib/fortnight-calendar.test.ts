import { describe, expect, it } from 'vitest';
import {
  getNextCalendarFortnight,
  getFortnightPeriodForDay,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';

describe('getFortnightPeriodForDay', () => {
  it('maps 1–15 to FIRST', () => {
    expect(getFortnightPeriodForDay(1)).toBe('FIRST');
    expect(getFortnightPeriodForDay(15)).toBe('FIRST');
  });

  it('maps 16+ to SECOND', () => {
    expect(getFortnightPeriodForDay(16)).toBe('SECOND');
    expect(getFortnightPeriodForDay(31)).toBe('SECOND');
  });
});

describe('getNextCalendarFortnight', () => {
  it('returns SECOND same month when asOf is in FIRST', () => {
    const asOf = new Date(2026, 4, 10);
    expect(getNextCalendarFortnight(asOf)).toEqual({
      year: 2026,
      month: 5,
      period: 'SECOND',
    });
  });

  it('returns FIRST next month when asOf is in SECOND same year', () => {
    const asOf = new Date(2026, 4, 20);
    expect(getNextCalendarFortnight(asOf)).toEqual({
      year: 2026,
      month: 6,
      period: 'FIRST',
    });
  });

  it('rolls December SECOND to January FIRST next year', () => {
    const asOf = new Date(2026, 11, 20);
    expect(getNextCalendarFortnight(asOf)).toEqual({
      year: 2027,
      month: 1,
      period: 'FIRST',
    });
  });
});

describe('isCalendarFortnightNext', () => {
  it('is true only for computed next fortnight', () => {
    const asOf = new Date(2026, 4, 10);
    expect(isCalendarFortnightNext(2026, 5, 'SECOND', asOf)).toBe(true);
    expect(isCalendarFortnightNext(2026, 5, 'FIRST', asOf)).toBe(false);
    expect(isCalendarFortnightNext(2026, 6, 'FIRST', asOf)).toBe(false);
  });
});
