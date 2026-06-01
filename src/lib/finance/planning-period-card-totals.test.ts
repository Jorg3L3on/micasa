import { describe, expect, it } from 'vitest';
import {
  applyCardStatementDueToExpenseTotals,
  applyOrphanCardPaymentsToExpenseTotals,
  mergePlanningCardTotalsIntoExpenseSummary,
} from '@/lib/finance/planning-period-card-totals';

describe('planning-period-card-totals', () => {
  it('orphan payments increase expense and paid equally', () => {
    const result = applyOrphanCardPaymentsToExpenseTotals(
      { totalExpense: 1000, totalPaid: 400, totalUnpaid: 600 },
      { total: 200, count: 1 },
    );
    expect(result).toEqual({
      totalExpense: 1200,
      totalPaid: 600,
      totalUnpaid: 600,
    });
  });

  it('card statement due increases expense only (unpaid obligation)', () => {
    const result = applyCardStatementDueToExpenseTotals(
      { totalExpense: 1000, totalPaid: 400, totalUnpaid: 600 },
      { total: 300, cardCount: 1 },
    );
    expect(result).toEqual({
      totalExpense: 1300,
      totalPaid: 400,
      totalUnpaid: 900,
    });
  });

  it('does not double-count unpaid when orphan and card due are combined', () => {
    const result = mergePlanningCardTotalsIntoExpenseSummary(
      { totalExpense: 1000, totalPaid: 400, totalUnpaid: 600 },
      { total: 200, count: 1 },
      { total: 300, cardCount: 1 },
    );
    expect(result.totalExpense).toBe(1500);
    expect(result.totalPaid).toBe(600);
    expect(result.totalUnpaid).toBe(900);
  });
});
