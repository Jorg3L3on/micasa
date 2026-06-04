import { describe, expect, it } from 'vitest';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

describe('MonthlyBudgetPanelResult shape', () => {
  it('empty panel has zero totals', () => {
    const empty: MonthlyBudgetPanelResult = {
      totalBudget: 0,
      spent: 0,
      available: 0,
      categories: [],
    };
    expect(empty.available).toBe(0);
    expect(empty.categories).toHaveLength(0);
  });
});
