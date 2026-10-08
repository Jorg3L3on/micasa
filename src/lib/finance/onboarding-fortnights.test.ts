import { describe, expect, it } from 'vitest';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { generateOnboardingFortnights } from '@/lib/finance/onboarding-fortnights';

const ymd = (d: Date) => formatCalendarDate(d);

describe('generateOnboardingFortnights', () => {
  it('starts on the last day of the previous month and alternates periods', () => {
    const rows = generateOnboardingFortnights('2026-10-01');
    expect(rows.map((r) => [r.period, r.month, r.year])).toEqual([
      ['FIRST', 10, 2026],
      ['SECOND', 10, 2026],
      ['FIRST', 11, 2026],
      ['SECOND', 11, 2026],
    ]);
    expect(ymd(rows[0].startDate)).toBe('2026-09-30');
    expect(ymd(rows[0].endDate)).toBe('2026-10-14');
    expect(ymd(rows[1].startDate)).toBe('2026-10-15');
    expect(ymd(rows[1].endDate)).toBe('2026-10-30');
  });

  it('rolls into the next year', () => {
    const rows = generateOnboardingFortnights('2026-12-01');
    expect(rows.map((r) => [r.month, r.year])).toEqual([
      [12, 2026],
      [12, 2026],
      [1, 2027],
      [1, 2027],
    ]);
  });

  it('returns nothing for an invalid date', () => {
    expect(generateOnboardingFortnights('2026-13-01')).toEqual([]);
  });
});
