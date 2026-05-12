import { describe, expect, it } from 'vitest';
import { computeBudgetWindows } from './budget-period.service';

const d = (year: number, month: number, day: number, h = 0, m = 0, s = 0, ms = 0) =>
  new Date(year, month - 1, day, h, m, s, ms);

const MAY_FIRST: { start_date: Date; end_date: Date } = {
  start_date: d(2026, 5, 1),
  end_date: d(2026, 5, 15),
};

const MAY_SECOND: { start_date: Date; end_date: Date } = {
  start_date: d(2026, 5, 16),
  end_date: d(2026, 5, 31),
};

const FEB_SECOND: { start_date: Date; end_date: Date } = {
  start_date: d(2026, 2, 16),
  end_date: d(2026, 2, 28),
};

describe('computeBudgetWindows – CUSTOM', () => {
  it('returns no windows', () => {
    expect(computeBudgetWindows('CUSTOM', MAY_FIRST)).toEqual([]);
    expect(computeBudgetWindows('CUSTOM', MAY_FIRST, d(2026, 5, 6))).toEqual([]);
  });
});

describe('computeBudgetWindows – BIWEEKLY', () => {
  it('returns one window matching the full fortnight', () => {
    const [w] = computeBudgetWindows('BIWEEKLY', MAY_FIRST);
    expect(w.start_date).toEqual(MAY_FIRST.start_date);
    expect(w.end_date).toEqual(MAY_FIRST.end_date);
  });

  it('ignores fromToday and still returns the full fortnight', () => {
    const windows = computeBudgetWindows('BIWEEKLY', MAY_FIRST, d(2026, 5, 10));
    expect(windows).toHaveLength(1);
  });
});

describe('computeBudgetWindows – WEEKLY', () => {
  it('FIRST fortnight: two fixed 7-day windows', () => {
    const windows = computeBudgetWindows('WEEKLY', MAY_FIRST);
    expect(windows).toHaveLength(2);
    expect(windows[0].start_date).toEqual(d(2026, 5, 1, 0, 0, 0, 0));
    expect(windows[0].end_date).toEqual(d(2026, 5, 7, 23, 59, 59, 999));
    expect(windows[1].start_date).toEqual(d(2026, 5, 8, 0, 0, 0, 0));
    expect(windows[1].end_date).toEqual(d(2026, 5, 15, 23, 59, 59, 999));
  });

  it('SECOND fortnight (31-day month): 16-22 and 23-31', () => {
    const windows = computeBudgetWindows('WEEKLY', MAY_SECOND);
    expect(windows).toHaveLength(2);
    expect(windows[0].start_date).toEqual(d(2026, 5, 16, 0, 0, 0, 0));
    expect(windows[0].end_date).toEqual(d(2026, 5, 22, 23, 59, 59, 999));
    expect(windows[1].start_date).toEqual(d(2026, 5, 23, 0, 0, 0, 0));
    expect(windows[1].end_date).toEqual(d(2026, 5, 31, 23, 59, 59, 999));
  });

  it('SECOND fortnight (28-day month): 16-22 and 23-28', () => {
    const windows = computeBudgetWindows('WEEKLY', FEB_SECOND);
    expect(windows[1].end_date).toEqual(d(2026, 2, 28, 23, 59, 59, 999));
  });

  it('fromToday in week 1 includes both weeks', () => {
    const windows = computeBudgetWindows('WEEKLY', MAY_FIRST, d(2026, 5, 3));
    expect(windows).toHaveLength(2);
  });

  it('fromToday in week 2 excludes week 1', () => {
    const windows = computeBudgetWindows('WEEKLY', MAY_FIRST, d(2026, 5, 9));
    expect(windows).toHaveLength(1);
    expect(windows[0].start_date).toEqual(d(2026, 5, 8, 0, 0, 0, 0));
  });

  it('fromToday on the last day of week 1 still includes week 1', () => {
    const windows = computeBudgetWindows('WEEKLY', MAY_FIRST, d(2026, 5, 7));
    expect(windows).toHaveLength(2);
  });
});

describe('computeBudgetWindows – DAILY', () => {
  it('full fortnight when no fromToday: 15 windows', () => {
    const windows = computeBudgetWindows('DAILY', MAY_FIRST);
    expect(windows).toHaveLength(15);
    expect(windows[0].start_date).toEqual(d(2026, 5, 1, 0, 0, 0, 0));
    expect(windows[0].end_date).toEqual(d(2026, 5, 1, 23, 59, 59, 999));
    expect(windows[14].start_date).toEqual(d(2026, 5, 15, 0, 0, 0, 0));
  });

  it('fromToday mid-fortnight: generates remaining days only', () => {
    const windows = computeBudgetWindows('DAILY', MAY_FIRST, d(2026, 5, 10));
    expect(windows).toHaveLength(6); // days 10–15
    expect(windows[0].start_date).toEqual(d(2026, 5, 10, 0, 0, 0, 0));
    expect(windows[5].start_date).toEqual(d(2026, 5, 15, 0, 0, 0, 0));
  });

  it('fromToday on last day: generates one window', () => {
    const windows = computeBudgetWindows('DAILY', MAY_FIRST, d(2026, 5, 15));
    expect(windows).toHaveLength(1);
    expect(windows[0].start_date).toEqual(d(2026, 5, 15, 0, 0, 0, 0));
  });

  it('fromToday after fortnight end: generates no windows', () => {
    const windows = computeBudgetWindows('DAILY', MAY_FIRST, d(2026, 5, 16));
    expect(windows).toHaveLength(0);
  });

  it('SECOND fortnight 31 days: 16 windows', () => {
    const windows = computeBudgetWindows('DAILY', MAY_SECOND);
    expect(windows).toHaveLength(16); // days 16–31
  });
});
