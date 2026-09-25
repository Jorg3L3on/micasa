import { describe, expect, it } from 'vitest';
import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import {
  isStalePastDueGap,
  plannerAsOfForCardMonth,
} from '@/lib/finance/card-obligation-cycle';
import { resolveCreditCardStatementWindow } from '@/lib/finance/card-statement-obligation';
import { canAdvanceToNextCreditCardCycle } from '@/lib/finance/credit-card-cycle-types';

describe('planner cycle selection', () => {
  const today = parseCalendarDate('2026-05-20');

  it('drops a past-due gap once the next cycle is the live one', () => {
    expect(
      isStalePastDueGap({
        statementDueDate: '2026-05-08',
        cutoffDay: 15,
        dueDay: 8,
        plannerStatus: 'falta_dato',
        periodObligation: { confidence: 'missing' },
        today,
      }),
    ).toBe(true);
  });

  it('keeps a past-due cycle that already has a payment', () => {
    expect(
      isStalePastDueGap({
        statementDueDate: '2026-05-08',
        cutoffDay: 15,
        dueDay: 8,
        plannerStatus: 'pagado',
        paymentsAppliedToFortnight: 100,
        today,
      }),
    ).toBe(false);
  });

  it('reads the same window statement view uses for the open cycle', () => {
    const asOf = plannerAsOfForCardMonth({
      year: 2026,
      month: 6,
      cutoffDay: 15,
      dueDay: 8,
      today,
    });
    expect(asOf).not.toBeNull();
    const selected = resolveCreditCardStatementWindow(asOf!, 15, 8);
    const live = resolveCreditCardStatementWindow(today, 15, 8);
    expect(formatCalendarDate(selected.statementEnd)).toBe(
      formatCalendarDate(live.statementEnd),
    );
    expect(formatCalendarDate(selected.statementDueDate)).toBe('2026-06-08');
  });
});

describe('next cycle control', () => {
  it('stays enabled on the current cycle when a next cycle can be anchored', () => {
    expect(canAdvanceToNextCreditCardCycle('2026-06-15')).toBe(true);
    expect(canAdvanceToNextCreditCardCycle('')).toBe(false);
    expect(canAdvanceToNextCreditCardCycle(null)).toBe(false);
  });
});
