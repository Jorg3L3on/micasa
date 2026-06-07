import { describe, expect, it } from 'vitest';
import {
  compareCalendarFortnight,
  getCurrentCalendarFortnightRef,
  getNextCalendarFortnight,
  getFortnightPeriodForDay,
  getSuggestedFortnightPeriodForMonth,
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

describe('compareCalendarFortnight', () => {
  it('orders year, month, then period', () => {
    expect(
      compareCalendarFortnight(
        { year: 2026, month: 5, period: 'SECOND' },
        { year: 2026, month: 6, period: 'FIRST' },
      ),
    ).toBeLessThan(0);
    expect(
      compareCalendarFortnight(
        { year: 2026, month: 6, period: 'FIRST' },
        { year: 2026, month: 6, period: 'SECOND' },
      ),
    ).toBeLessThan(0);
  });
});

describe('getNextCalendarFortnight', () => {
  it('returns SECOND same month when asOf is in FIRST', () => {
    const asOf = new Date('2026-05-10T18:00:00.000Z');
    expect(getNextCalendarFortnight(asOf)).toEqual({
      year: 2026,
      month: 5,
      period: 'SECOND',
    });
  });

  it('returns FIRST next month when asOf is in SECOND same year', () => {
    const asOf = new Date('2026-05-20T18:00:00.000Z');
    expect(getNextCalendarFortnight(asOf)).toEqual({
      year: 2026,
      month: 6,
      period: 'FIRST',
    });
  });

  it('rolls December SECOND to January FIRST next year', () => {
    const asOf = new Date('2026-12-20T18:00:00.000Z');
    expect(getNextCalendarFortnight(asOf)).toEqual({
      year: 2027,
      month: 1,
      period: 'FIRST',
    });
  });
});

describe('isCalendarFortnightNext', () => {
  it('is true only for computed next fortnight', () => {
    const asOf = new Date('2026-05-10T18:00:00.000Z');
    expect(isCalendarFortnightNext(2026, 5, 'SECOND', asOf)).toBe(true);
    expect(isCalendarFortnightNext(2026, 5, 'FIRST', asOf)).toBe(false);
    expect(isCalendarFortnightNext(2026, 6, 'FIRST', asOf)).toBe(false);
  });
});

describe('getSuggestedFortnightPeriodForMonth', () => {
  const asOf = new Date('2026-06-04T18:00:00.000Z');

  it('defaults past months to SECOND', () => {
    expect(getSuggestedFortnightPeriodForMonth(2026, 5, asOf)).toBe('SECOND');
  });

  it('defaults future months to FIRST', () => {
    expect(getSuggestedFortnightPeriodForMonth(2026, 7, asOf)).toBe('FIRST');
  });

  it('defaults current month to active period', () => {
    expect(getSuggestedFortnightPeriodForMonth(2026, 6, asOf)).toBe('FIRST');
  });
});

describe('getCurrentCalendarFortnightRef', () => {
  const mxNoon = (ymd: string) => new Date(`${ymd}T18:00:00.000Z`);

  it('maps Mexico City days 1 through 15 to FIRST', () => {
    expect(getCurrentCalendarFortnightRef(mxNoon('2026-06-15'))).toEqual({
      year: 2026,
      month: 6,
      period: 'FIRST',
    });
  });

  it('maps Mexico City days 16 through month end to SECOND', () => {
    expect(getCurrentCalendarFortnightRef(mxNoon('2026-06-16'))).toEqual({
      year: 2026,
      month: 6,
      period: 'SECOND',
    });
  });
});
