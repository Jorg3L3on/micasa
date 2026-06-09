import { describe, expect, it } from 'vitest';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/calendar-dates';
import { computeBudgetWindows } from './budget-period.service';

const juneFirstFortnight = {
  start_date: startOfCalendarDay('2026-06-01'),
  end_date: endOfCalendarDay('2026-06-15'),
};

const juneSecondFortnight = {
  start_date: startOfCalendarDay('2026-06-16'),
  end_date: endOfCalendarDay('2026-06-30'),
};

const febSecondFortnight = {
  start_date: startOfCalendarDay('2026-02-16'),
  end_date: endOfCalendarDay('2026-02-28'),
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
  it('FIRST fortnight: calendar weeks clipped to 1–15', () => {
    const windows = computeBudgetWindows('WEEKLY', juneFirstFortnight);
    expect(windows).toHaveLength(3);
    expect(windows[0].start_date).toEqual(startOfCalendarDay('2026-06-01'));
    expect(windows[0].end_date).toEqual(endOfCalendarDay('2026-06-06'));
    expect(windows[1].start_date).toEqual(startOfCalendarDay('2026-06-07'));
    expect(windows[1].end_date).toEqual(endOfCalendarDay('2026-06-13'));
    expect(windows[2].start_date).toEqual(startOfCalendarDay('2026-06-14'));
    expect(windows[2].end_date).toEqual(endOfCalendarDay('2026-06-15'));
  });

  it('SECOND fortnight (31-day month): weeks through end of month', () => {
    const windows = computeBudgetWindows('WEEKLY', juneSecondFortnight);
    expect(windows.at(-1)?.end_date).toEqual(endOfCalendarDay('2026-06-30'));
  });

  it('SECOND fortnight (28-day month): ends on the 28th', () => {
    const windows = computeBudgetWindows('WEEKLY', febSecondFortnight);
    expect(windows.at(-1)?.end_date).toEqual(endOfCalendarDay('2026-02-28'));
  });
});

describe('computeBudgetWindows – DAILY', () => {
  it('generates one window per civil day in the fortnight', () => {
    const windows = computeBudgetWindows('DAILY', juneFirstFortnight);
    expect(windows).toHaveLength(15);
    expect(windows[0].start_date).toEqual(startOfCalendarDay('2026-06-01'));
    expect(windows[0].end_date).toEqual(endOfCalendarDay('2026-06-01'));
    expect(windows[14].start_date).toEqual(startOfCalendarDay('2026-06-15'));
  });

  it('SECOND fortnight 30-day month: 15 windows (16–30)', () => {
    const windows = computeBudgetWindows('DAILY', juneSecondFortnight);
    expect(windows).toHaveLength(15);
    expect(windows[0].start_date).toEqual(startOfCalendarDay('2026-06-16'));
  });
});
