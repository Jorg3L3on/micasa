import { describe, expect, it } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { computeBudgetTemplateDateRange } from './budget-template-date-range';

const mxNoon = (ymd: string) => new Date(`${ymd}T18:00:00.000Z`);

describe('computeBudgetTemplateDateRange', () => {
  it('uses the current Mexico City calendar day for DAILY budgets', () => {
    const range = computeBudgetTemplateDateRange({
      frequency: 'DAILY',
      now: mxNoon('2026-06-04'),
    });

    const day = parseCalendarDate('2026-06-04');
    expect(range.start_date).toEqual(day);
    expect(range.end_date).toEqual(day);
  });

  it('uses the Sunday to Saturday calendar week for WEEKLY budgets', () => {
    const range = computeBudgetTemplateDateRange({
      frequency: 'WEEKLY',
      now: mxNoon('2026-06-04'),
    });

    expect(range.start_date).toEqual(parseCalendarDate('2026-05-31'));
    expect(range.end_date).toEqual(parseCalendarDate('2026-06-06'));
  });

  it('keeps Sunday as the start of the current week', () => {
    const range = computeBudgetTemplateDateRange({
      frequency: 'WEEKLY',
      now: mxNoon('2026-06-07'),
    });

    expect(range.start_date).toEqual(parseCalendarDate('2026-06-07'));
    expect(range.end_date).toEqual(parseCalendarDate('2026-06-13'));
  });

  it('uses the current Fortnight row for BIWEEKLY budgets', () => {
    const currentFortnight = {
      start_date: new Date('2026-06-01T12:00:00.000Z'),
      end_date: new Date('2026-06-15T12:00:00.000Z'),
    };

    expect(
      computeBudgetTemplateDateRange({
        frequency: 'BIWEEKLY',
        currentFortnight,
      }),
    ).toEqual(currentFortnight);
  });

  it('uses parseCalendarDate for CUSTOM YYYY-MM-DD form dates', () => {
    const range = computeBudgetTemplateDateRange({
      frequency: 'CUSTOM',
      customStartDate: '2026-06-04',
      customEndDate: '2026-06-10',
    });

    expect(range.start_date).toEqual(parseCalendarDate('2026-06-04'));
    expect(range.end_date).toEqual(parseCalendarDate('2026-06-10'));
  });
});
