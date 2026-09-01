import { describe, expect, it } from 'vitest';
import {
  compareCalendarFortnight,
  dueDayFallsInFortnight,
  formatDayMonthLabel,
  formatFortnightDateRangeLabel,
  getAppHomeHref,
  getCalendarFortnightRefForYmd,
  getCurrentCalendarFortnightRef,
  getCurrentMonthlyPanelHref,
  getDaysInCalendarMonth,
  getDefaultDateForFortnight,
  getFortnightCalendarBounds,
  getFortnightPeriodPosition,
  getFortnightYmdBounds,
  getNextCalendarFortnight,
  getSuggestedFortnightPeriodForMonth,
  isCalendarFortnightNext,
  ymdFallsInFortnight,
} from '@/lib/fortnight-calendar';

const mxNoon = (ymd: string) => new Date(`${ymd}T18:00:00.000Z`);

describe('getCalendarFortnightRefForYmd', () => {
  it.each([
    ['2026-06-01', { year: 2026, month: 6, period: 'FIRST' }],
    ['2026-06-14', { year: 2026, month: 6, period: 'FIRST' }],
    ['2026-06-15', { year: 2026, month: 6, period: 'SECOND' }],
    ['2026-06-29', { year: 2026, month: 6, period: 'SECOND' }],
    ['2026-06-30', { year: 2026, month: 7, period: 'FIRST' }],
    ['2026-05-31', { year: 2026, month: 6, period: 'FIRST' }],
    ['2026-01-31', { year: 2026, month: 2, period: 'FIRST' }],
    ['2026-02-14', { year: 2026, month: 2, period: 'FIRST' }],
    ['2026-02-15', { year: 2026, month: 2, period: 'SECOND' }],
    ['2026-02-27', { year: 2026, month: 2, period: 'SECOND' }],
    ['2026-02-28', { year: 2026, month: 3, period: 'FIRST' }],
    ['2024-02-29', { year: 2024, month: 3, period: 'FIRST' }],
    ['2024-02-28', { year: 2024, month: 2, period: 'SECOND' }],
    ['2026-12-31', { year: 2027, month: 1, period: 'FIRST' }],
  ] as const)('maps %s', (ymd, expected) => {
    expect(getCalendarFortnightRefForYmd(ymd)).toEqual(expected);
  });
});

describe('getFortnightYmdBounds', () => {
  it('June FIRST starts on May 31 and ends on the 14th', () => {
    expect(getFortnightYmdBounds(2026, 6, 'FIRST')).toEqual({
      startYmd: '2026-05-31',
      endYmd: '2026-06-14',
    });
  });

  it('June SECOND is 15 through the penultimate day', () => {
    expect(getFortnightYmdBounds(2026, 6, 'SECOND')).toEqual({
      startYmd: '2026-06-15',
      endYmd: '2026-06-29',
    });
  });

  it('May SECOND (31-day month) ends on the 30th', () => {
    expect(getFortnightYmdBounds(2026, 5, 'SECOND')).toEqual({
      startYmd: '2026-05-15',
      endYmd: '2026-05-30',
    });
  });

  it('February 2026 SECOND ends on the 27th', () => {
    expect(getFortnightYmdBounds(2026, 2, 'SECOND')).toEqual({
      startYmd: '2026-02-15',
      endYmd: '2026-02-27',
    });
  });

  it('February 2024 leap FIRST starts on Jan 31', () => {
    expect(getFortnightYmdBounds(2024, 2, 'FIRST')).toEqual({
      startYmd: '2024-01-31',
      endYmd: '2024-02-14',
    });
  });
});

describe('dueDayFallsInFortnight', () => {
  it('due day 31 matches June FIRST (May 31), not June SECOND', () => {
    expect(dueDayFallsInFortnight(31, 2026, 6, 'FIRST')).toBe(true);
    expect(dueDayFallsInFortnight(31, 2026, 6, 'SECOND')).toBe(false);
  });

  it('due day 30 matches July FIRST (June 30)', () => {
    expect(dueDayFallsInFortnight(30, 2026, 7, 'FIRST')).toBe(true);
    expect(dueDayFallsInFortnight(30, 2026, 6, 'SECOND')).toBe(false);
  });

  it('due day 15 is SECOND', () => {
    expect(dueDayFallsInFortnight(15, 2026, 6, 'FIRST')).toBe(false);
    expect(dueDayFallsInFortnight(15, 2026, 6, 'SECOND')).toBe(true);
  });
});

describe('ymdFallsInFortnight', () => {
  it('places May 31 in June FIRST', () => {
    expect(ymdFallsInFortnight('2026-05-31', 2026, 6, 'FIRST')).toBe(true);
    expect(ymdFallsInFortnight('2026-05-31', 2026, 5, 'SECOND')).toBe(false);
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
    expect(getNextCalendarFortnight(mxNoon('2026-05-10'))).toEqual({
      year: 2026,
      month: 5,
      period: 'SECOND',
    });
  });

  it('returns FIRST next month when asOf is in SECOND', () => {
    expect(getNextCalendarFortnight(mxNoon('2026-05-20'))).toEqual({
      year: 2026,
      month: 6,
      period: 'FIRST',
    });
  });

  it('from last day of May, current is June FIRST so next is June SECOND', () => {
    expect(getNextCalendarFortnight(mxNoon('2026-05-31'))).toEqual({
      year: 2026,
      month: 6,
      period: 'SECOND',
    });
  });

  it('rolls December last day to January SECOND of next year', () => {
    expect(getCurrentCalendarFortnightRef(mxNoon('2026-12-31'))).toEqual({
      year: 2027,
      month: 1,
      period: 'FIRST',
    });
    expect(getNextCalendarFortnight(mxNoon('2026-12-31'))).toEqual({
      year: 2027,
      month: 1,
      period: 'SECOND',
    });
  });
});

describe('isCalendarFortnightNext', () => {
  it('is true only for computed next fortnight', () => {
    const asOf = mxNoon('2026-05-10');
    expect(isCalendarFortnightNext(2026, 5, 'SECOND', asOf)).toBe(true);
    expect(isCalendarFortnightNext(2026, 5, 'FIRST', asOf)).toBe(false);
    expect(isCalendarFortnightNext(2026, 6, 'FIRST', asOf)).toBe(false);
  });
});

describe('getSuggestedFortnightPeriodForMonth', () => {
  const asOf = mxNoon('2026-06-04');

  it('defaults past months to SECOND', () => {
    expect(getSuggestedFortnightPeriodForMonth(2026, 5, asOf)).toBe('SECOND');
  });

  it('defaults future months to FIRST', () => {
    expect(getSuggestedFortnightPeriodForMonth(2026, 7, asOf)).toBe('FIRST');
  });

  it('defaults current month to active period', () => {
    expect(getSuggestedFortnightPeriodForMonth(2026, 6, asOf)).toBe('FIRST');
  });

  it('on last day of June, June is past and July is current FIRST', () => {
    const lastDay = mxNoon('2026-06-30');
    expect(getSuggestedFortnightPeriodForMonth(2026, 6, lastDay)).toBe('SECOND');
    expect(getSuggestedFortnightPeriodForMonth(2026, 7, lastDay)).toBe('FIRST');
  });
});

describe('getCurrentMonthlyPanelHref', () => {
  it('links to the payday-aligned month', () => {
    expect(getCurrentMonthlyPanelHref(mxNoon('2026-07-24'))).toBe(
      '/monthly/2026/07',
    );
  });

  it('on the last day of the month, links to next month', () => {
    expect(getCurrentMonthlyPanelHref(mxNoon('2026-06-30'))).toBe(
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
  it('maps the 14th to FIRST of the civil month', () => {
    expect(getCurrentCalendarFortnightRef(mxNoon('2026-06-14'))).toEqual({
      year: 2026,
      month: 6,
      period: 'FIRST',
    });
  });

  it('maps the 15th to SECOND', () => {
    expect(getCurrentCalendarFortnightRef(mxNoon('2026-06-15'))).toEqual({
      year: 2026,
      month: 6,
      period: 'SECOND',
    });
  });

  it('maps the last civil day to next month FIRST', () => {
    expect(getCurrentCalendarFortnightRef(mxNoon('2026-06-30'))).toEqual({
      year: 2026,
      month: 7,
      period: 'FIRST',
    });
  });
});

describe('getFortnightCalendarBounds', () => {
  it('returns payday-aligned FIRST including previous month last day', () => {
    expect(getFortnightCalendarBounds(2025, 5, 'FIRST')).toEqual({
      startYmd: '2025-04-30',
      endYmd: '2025-05-14',
      startDay: 30,
      endDay: 14,
      totalDays: 15,
    });
  });

  it('returns 15 through penultimate for SECOND', () => {
    expect(getFortnightCalendarBounds(2025, 5, 'SECOND')).toEqual({
      startYmd: '2025-05-15',
      endYmd: '2025-05-30',
      startDay: 15,
      endDay: 30,
      totalDays: 16,
    });
    expect(getDaysInCalendarMonth(2025, 2)).toBe(28);
    expect(getFortnightCalendarBounds(2025, 2, 'SECOND').endDay).toBe(27);
  });
});

describe('getFortnightPeriodPosition', () => {
  it('returns current with elapsed and remaining days inside FIRST', () => {
    expect(
      getFortnightPeriodPosition(2025, 5, 'FIRST', '2025-05-10'),
    ).toEqual({
      kind: 'current',
      elapsedPercent: 73,
      elapsedDays: 11,
      remainingDays: 5,
    });
  });

  it('counts May 31 as day 1 of June FIRST', () => {
    expect(
      getFortnightPeriodPosition(2026, 6, 'FIRST', '2026-05-31'),
    ).toEqual({
      kind: 'current',
      elapsedPercent: 7,
      elapsedDays: 1,
      remainingDays: 15,
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

  it('returns remainingDays 1 on the last day of FIRST (the 14th)', () => {
    expect(
      getFortnightPeriodPosition(2025, 5, 'FIRST', '2025-05-14'),
    ).toMatchObject({
      kind: 'current',
      remainingDays: 1,
      elapsedPercent: 100,
    });
  });
});

describe('formatDayMonthLabel / formatFortnightDateRangeLabel', () => {
  it('formats Spanish day and month', () => {
    expect(formatDayMonthLabel(2025, 5, 10)).toBe('10 de mayo');
  });

  it('formats a cross-month FIRST range', () => {
    expect(formatFortnightDateRangeLabel(2026, 6, 'FIRST')).toBe(
      '31 de mayo al 14 de junio',
    );
  });

  it('formats SECOND through the penultimate day', () => {
    expect(formatFortnightDateRangeLabel(2026, 6, 'SECOND')).toBe(
      '15 de junio al 29 de junio',
    );
  });
});

describe('getDefaultDateForFortnight', () => {
  it('returns today when today is inside the fortnight', () => {
    expect(getDefaultDateForFortnight(2026, 6, 'FIRST', '2026-06-10')).toBe(
      '2026-06-10',
    );
  });

  it('returns the start YMD otherwise', () => {
    expect(getDefaultDateForFortnight(2026, 6, 'FIRST', '2026-06-20')).toBe(
      '2026-05-31',
    );
  });
});
