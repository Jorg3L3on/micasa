import { describe, expect, it } from 'vitest';
import {
  compareCalendarFortnight,
  formatDayMonthLabel,
  getCurrentCalendarFortnightRef,
  getAppHomeHref,
  getCurrentMonthlyPanelHref,
  getDaysInCalendarMonth,
  getFortnightCalendarBounds,
  getFortnightPeriodPosition,
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

describe('getCurrentMonthlyPanelHref', () => {
  const mxNoon = (ymd: string) => new Date(`${ymd}T18:00:00.000Z`);

  it('links to the Mexico City calendar month', () => {
    expect(getCurrentMonthlyPanelHref(mxNoon('2026-07-24'))).toBe(
      '/monthly/2026/07',
    );
  });

  it('zero-pads single-digit months', () => {
    expect(getCurrentMonthlyPanelHref(mxNoon('2026-01-05'))).toBe(
      '/monthly/2026/01',
    );
  });
});

describe('getAppHomeHref', () => {
  const mxNoon = (ymd: string) => new Date(`${ymd}T18:00:00.000Z`);

  it('matches the current monthly panel without a query', () => {
    expect(getAppHomeHref(null, mxNoon('2026-08-02'))).toBe('/monthly/2026/08');
  });

  it('appends owner query params', () => {
    expect(
      getAppHomeHref('ownerType=house&ownerId=3', mxNoon('2026-08-02')),
    ).toBe('/monthly/2026/08?ownerType=house&ownerId=3');
  });

  it('accepts URLSearchParams and strips a leading ?', () => {
    expect(
      getAppHomeHref('?ownerType=user&ownerId=1', mxNoon('2026-01-10')),
    ).toBe('/monthly/2026/01?ownerType=user&ownerId=1');
    expect(
      getAppHomeHref(
        new URLSearchParams({ ownerType: 'user', ownerId: '1' }),
        mxNoon('2026-01-10'),
      ),
    ).toBe('/monthly/2026/01?ownerType=user&ownerId=1');
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

describe('getFortnightCalendarBounds', () => {
  it('returns 1–15 for FIRST', () => {
    expect(getFortnightCalendarBounds(2025, 5, 'FIRST')).toEqual({
      startDay: 1,
      endDay: 15,
      totalDays: 15,
    });
  });

  it('returns 16–monthEnd for SECOND', () => {
    expect(getFortnightCalendarBounds(2025, 5, 'SECOND')).toEqual({
      startDay: 16,
      endDay: 31,
      totalDays: 16,
    });
    expect(getDaysInCalendarMonth(2025, 2)).toBe(28);
    expect(getFortnightCalendarBounds(2025, 2, 'SECOND').endDay).toBe(28);
  });
});

describe('getFortnightPeriodPosition', () => {
  it('returns current with elapsed and remaining days', () => {
    expect(
      getFortnightPeriodPosition(2025, 5, 'FIRST', '2025-05-10'),
    ).toEqual({
      kind: 'current',
      elapsedPercent: 67,
      elapsedDays: 10,
      remainingDays: 6,
    });
  });

  it('returns past and future outside the fortnight', () => {
    expect(
      getFortnightPeriodPosition(2025, 5, 'FIRST', '2025-05-20'),
    ).toEqual({ kind: 'past' });
    expect(
      getFortnightPeriodPosition(2025, 5, 'SECOND', '2025-05-10'),
    ).toEqual({ kind: 'future' });
  });

  it('returns remainingDays 1 on the last day', () => {
    expect(
      getFortnightPeriodPosition(2025, 5, 'FIRST', '2025-05-15'),
    ).toMatchObject({
      kind: 'current',
      remainingDays: 1,
      elapsedPercent: 100,
    });
  });
});

describe('formatDayMonthLabel', () => {
  it('formats Spanish day and month', () => {
    expect(formatDayMonthLabel(2025, 5, 10)).toBe('10 de mayo');
  });
});
