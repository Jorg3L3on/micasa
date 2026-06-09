import { describe, expect, it } from 'vitest';
import { buildDashboardBudgetSummary } from './dashboard-budget-summary';
import type {
  MonthlyBudgetCategoryRow,
  MonthlyBudgetPanelResult,
  MonthlyBudgetScope,
} from '@/types/monthly-budget-panel';

const category = (
  partial: Partial<MonthlyBudgetCategoryRow> & Pick<MonthlyBudgetCategoryRow, 'id' | 'name'>,
): MonthlyBudgetCategoryRow => ({
  icon: null,
  budgeted: 0,
  spent: 0,
  remaining: 0,
  percentUsed: 0,
  percentOfBudget: 0,
  ...partial,
});

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
          category({
            id: 1,
            name: 'Comida',
            budgeted: 500,
            spent: 250,
            remaining: 250,
            percentUsed: 50,
            percentOfBudget: 25,
          }),
        ],
        sources: [{ frequency: 'WEEKLY', totalBudget: 1000 }],
      }),
      second: scope({
        totalBudget: 2000,
        spent: 750,
        available: 1250,
        categories: [
          category({
            id: 1,
            name: 'Comida',
            budgeted: 1000,
            spent: 500,
            remaining: 500,
            percentUsed: 50,
            percentOfBudget: 25,
          }),
          category({
            id: 2,
            name: 'Casa',
            icon: 'HOME',
            budgeted: 500,
            spent: 250,
            remaining: 250,
            percentUsed: 50,
            percentOfBudget: 13,
          }),
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
        budgeted: 1500,
        spent: 750,
        remaining: 750,
        percentUsed: 50,
        percentOfBudget: 25,
      },
      {
        id: 2,
        name: 'Casa',
        icon: 'HOME',
        budgeted: 500,
        spent: 250,
        remaining: 250,
        percentUsed: 50,
        percentOfBudget: 8,
      },
    ]);
    expect(summary.sources).toEqual([
      { frequency: 'WEEKLY', totalBudget: 3000 },
    ]);
  });
});
