import { describe, expect, it } from 'vitest';
import { buildDashboardBudgetSummary } from './dashboard-budget-summary';
import type {
  MonthlyBudgetPanelResult,
  MonthlyBudgetScope,
} from '@/types/monthly-budget-panel';

const scope = (
  partial: Partial<MonthlyBudgetScope> = {},
): MonthlyBudgetScope => ({
  totalBudget: 0,
  spent: 0,
  available: 0,
  categories: [],
  sources: [],
  ...partial,
});

describe('buildDashboardBudgetSummary', () => {
  it('uses the selected fortnight scope for biweekly view', () => {
    const panel: MonthlyBudgetPanelResult = {
      first: scope({ totalBudget: 1000, spent: 250, available: 750 }),
      second: scope({ totalBudget: 2000, spent: 500, available: 1500 }),
    };

    const summary = buildDashboardBudgetSummary({
      view: 'biweekly',
      period: 'SECOND',
      panel,
    });

    expect(summary.totalBudget).toBe(2000);
    expect(summary.spent).toBe(500);
    expect(summary.available).toBe(1500);
    expect(summary.usedPercent).toBe(25);
  });

  it('combines both fortnight scopes for month view', () => {
    const panel: MonthlyBudgetPanelResult = {
      first: scope({
        totalBudget: 1000,
        spent: 250,
        available: 750,
        categories: [
          {
            id: 1,
            name: 'Comida',
            icon: null,
            spent: 250,
            percentOfBudget: 25,
          },
        ],
        sources: [{ frequency: 'WEEKLY', totalBudget: 1000 }],
      }),
      second: scope({
        totalBudget: 2000,
        spent: 750,
        available: 1250,
        categories: [
          {
            id: 1,
            name: 'Comida',
            icon: null,
            spent: 500,
            percentOfBudget: 25,
          },
          {
            id: 2,
            name: 'Casa',
            icon: 'HOME',
            spent: 250,
            percentOfBudget: 13,
          },
        ],
        sources: [{ frequency: 'WEEKLY', totalBudget: 2000 }],
      }),
    };

    const summary = buildDashboardBudgetSummary({
      view: 'month',
      period: 'FIRST',
      panel,
    });

    expect(summary.totalBudget).toBe(3000);
    expect(summary.spent).toBe(1000);
    expect(summary.available).toBe(2000);
    expect(summary.usedPercent).toBe(33);
    expect(summary.categories).toEqual([
      {
        id: 1,
        name: 'Comida',
        icon: null,
        spent: 750,
        percentOfBudget: 25,
      },
      {
        id: 2,
        name: 'Casa',
        icon: 'HOME',
        spent: 250,
        percentOfBudget: 8,
      },
    ]);
    expect(summary.sources).toEqual([
      { frequency: 'WEEKLY', totalBudget: 3000 },
    ]);
  });
});
