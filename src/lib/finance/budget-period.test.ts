import { describe, expect, it } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { computeBudgetWindows } from './budget-period.service';
import {
  canonicalizeWeeklyPeriod,
  canonicalizeDailyPeriod,
  canonicalizeCustomPeriod,
  computeBudgetPeriodWindowsForFortnight,
} from './budget-period-windows';

const juneFirstFortnight = {
  start_date: parseCalendarDate('2026-05-31'),
  end_date: parseCalendarDate('2026-06-14'),
};

const juneSecondFortnight = {
  start_date: parseCalendarDate('2026-06-15'),
  end_date: parseCalendarDate('2026-06-29'),
};

const febSecondFortnight = {
  start_date: parseCalendarDate('2026-02-15'),
  end_date: parseCalendarDate('2026-02-27'),
};

describe('computeBudgetWindows – CUSTOM', () => {
  it('returns no windows', () => {
    expect(computeBudgetWindows('CUSTOM', juneFirstFortnight)).toEqual([]);
  });
});

describe('computeBudgetWindows – BIWEEKLY', () => {
  it('returns one window matching the full fortnight', () => {
    const [w] = computeBudgetWindows('BIWEEKLY', juneFirstFortnight);
    expect(w.start_date).toEqual(juneFirstFortnight.start_date);
    expect(w.end_date).toEqual(juneFirstFortnight.end_date);
  });
});

describe('computeBudgetWindows – WEEKLY', () => {
  it('FIRST fortnight: full Sun–Sat weeks overlapping payday FIRST (not clipped)', () => {
    const windows = computeBudgetWindows('WEEKLY', juneFirstFortnight);
    expect(windows).toHaveLength(3);
    // May 31 2026 is Sunday → week May 31–Jun 6 overlaps
    expect(windows[0].start_date).toEqual(parseCalendarDate('2026-05-31'));
    expect(windows[0].end_date).toEqual(parseCalendarDate('2026-06-06'));
    expect(windows[1].start_date).toEqual(parseCalendarDate('2026-06-07'));
    expect(windows[1].end_date).toEqual(parseCalendarDate('2026-06-13'));
    expect(windows[2].start_date).toEqual(parseCalendarDate('2026-06-14'));
    expect(windows[2].end_date).toEqual(parseCalendarDate('2026-06-20'));
  });

  it('SECOND fortnight (31-day month): last week may extend past month end', () => {
    const windows = computeBudgetWindows('WEEKLY', juneSecondFortnight);
    expect(windows.at(-1)?.end_date).toEqual(parseCalendarDate('2026-07-04'));
  });

  it('SECOND fortnight (28-day month): last week may extend past month end', () => {
    const windows = computeBudgetWindows('WEEKLY', febSecondFortnight);
    expect(windows.at(-1)?.end_date).toEqual(parseCalendarDate('2026-02-28'));
  });
});

describe('computeBudgetWindows – DAILY', () => {
  it('generates one window per civil day in the fortnight', () => {
    const windows = computeBudgetWindows('DAILY', juneFirstFortnight);
    expect(windows).toHaveLength(15);
    expect(windows[0].start_date).toEqual(parseCalendarDate('2026-05-31'));
    expect(windows[0].end_date).toEqual(parseCalendarDate('2026-05-31'));
    expect(windows[14].start_date).toEqual(parseCalendarDate('2026-06-14'));
  });

  it('SECOND fortnight 30-day month: 15 windows (15–29)', () => {
    const windows = computeBudgetWindows('DAILY', juneSecondFortnight);
    expect(windows).toHaveLength(15);
    expect(windows[0].start_date).toEqual(parseCalendarDate('2026-06-15'));
  });
});

describe('canonicalizeWeeklyPeriod', () => {
  it('snaps an 8-day timezone artifact onto the Sun–Sat week of its end day', () => {
    // Corrupted Aug 1–8 (8 days) that was meant to be Aug 2–8
    const canonical = canonicalizeWeeklyPeriod({
      start_date: new Date('2026-08-02T00:00:00.000Z'),
      end_date: new Date('2026-08-08T23:59:59.999Z'),
    });
    expect(canonical.start_date).toEqual(parseCalendarDate('2026-08-02'));
    expect(canonical.end_date).toEqual(parseCalendarDate('2026-08-08'));
  });

  it('expands a clipped stub to the full calendar week', () => {
    const canonical = canonicalizeWeeklyPeriod({
      start_date: parseCalendarDate('2026-08-30'),
      end_date: parseCalendarDate('2026-08-31'),
    });
    expect(canonical.start_date).toEqual(parseCalendarDate('2026-08-30'));
    expect(canonical.end_date).toEqual(parseCalendarDate('2026-09-05'));
  });
});

describe('canonicalizeDailyPeriod / canonicalizeCustomPeriod', () => {
  it('collapses a DAILY period onto a single UTC-noon civil day', () => {
    const canonical = canonicalizeDailyPeriod({
      start_date: parseCalendarDate('2026-08-02'),
      end_date: parseCalendarDate('2026-08-02'),
    });
    expect(canonical.start_date).toEqual(parseCalendarDate('2026-08-02'));
    expect(canonical.end_date).toEqual(parseCalendarDate('2026-08-02'));
  });

  it('rewrites CUSTOM range endpoints with parseCalendarDate', () => {
    const canonical = canonicalizeCustomPeriod({
      start_date: parseCalendarDate('2026-08-10'),
      end_date: parseCalendarDate('2026-08-20'),
    });
    expect(canonical.start_date).toEqual(parseCalendarDate('2026-08-10'));
    expect(canonical.end_date).toEqual(parseCalendarDate('2026-08-20'));
  });
});

describe('computeBudgetPeriodWindowsForFortnight WEEKLY August', () => {
  it('does not clip the partial first day of August into a 1-day stub', () => {
    const windows = computeBudgetPeriodWindowsForFortnight('WEEKLY', {
      start_date: parseCalendarDate('2026-08-01'),
      end_date: parseCalendarDate('2026-08-15'),
    });
    expect(windows[0]).toEqual({
      start_date: parseCalendarDate('2026-07-26'),
      end_date: parseCalendarDate('2026-08-01'),
    });
  });
});
