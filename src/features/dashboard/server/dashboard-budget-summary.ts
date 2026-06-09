import type {
  MonthlyBudgetPanelResult,
  MonthlyBudgetScope,
} from '@/types/monthly-budget-panel';
import type { DashboardBudgetSummary, PeriodView } from '@/types/dashboard';

type BuildDashboardBudgetSummaryInput = {
  view: PeriodView;
  period: 'FIRST' | 'SECOND';
  panel: MonthlyBudgetPanelResult;
};

export function buildDashboardBudgetSummary({
  view,
  period,
  panel,
}: BuildDashboardBudgetSummaryInput): DashboardBudgetSummary {
  const scope =
    view === 'month'
      ? combineBudgetScopes([panel.first, panel.second])
      : period === 'FIRST'
        ? panel.first
        : panel.second;

  return toDashboardBudgetSummary(scope);
}

function combineBudgetScopes(scopes: MonthlyBudgetScope[]): MonthlyBudgetScope {
  const totalBudget = scopes.reduce((sum, scope) => sum + scope.totalBudget, 0);
  const spent = scopes.reduce((sum, scope) => sum + scope.spent, 0);
  const categoryMap = new Map<
    number,
    { name: string; icon: string | null; budgeted: number; spent: number }
  >();
  const sourceMap = new Map<
    MonthlyBudgetScope['sources'][number]['frequency'],
    number
  >();

  for (const scope of scopes) {
    for (const category of scope.categories) {
      const current = categoryMap.get(category.id);
      if (current) {
        current.budgeted += category.budgeted;
        current.spent += category.spent;
      } else {
        categoryMap.set(category.id, {
          name: category.name,
          icon: category.icon,
          budgeted: category.budgeted,
          spent: category.spent,
        });
      }
    }

    for (const source of scope.sources) {
      sourceMap.set(
        source.frequency,
        (sourceMap.get(source.frequency) ?? 0) + source.totalBudget,
      );
    }
  }

  return {
    totalBudget,
    spent,
    available: Math.max(0, totalBudget - spent),
    categories: Array.from(categoryMap.entries())
      .map(([id, category]) => {
        const remaining = category.budgeted - category.spent;
        return {
          id,
          name: category.name,
          icon: category.icon,
          budgeted: category.budgeted,
          spent: category.spent,
          remaining,
          percentUsed:
            category.budgeted > 0
              ? Math.round((category.spent / category.budgeted) * 100)
              : 0,
          percentOfBudget:
            totalBudget > 0
              ? Math.round((category.spent / totalBudget) * 100)
              : 0,
        };
      })
      .sort((a, b) => b.percentUsed - a.percentUsed || b.spent - a.spent)
      .slice(0, 6),
    sources: Array.from(sourceMap.entries())
      .map(([frequency, sourceTotal]) => ({
        frequency,
        totalBudget: sourceTotal,
      }))
      .sort((a, b) => b.totalBudget - a.totalBudget),
  };
}

function toDashboardBudgetSummary(
  scope: MonthlyBudgetScope,
): DashboardBudgetSummary {
  const totalBudget = roundMoney(scope.totalBudget);
  const spent = roundMoney(scope.spent);
  const available = roundMoney(Math.max(0, totalBudget - spent));

  return {
    totalBudget,
    spent,
    available,
    usedPercent:
      totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : 0,
    categories: scope.categories.map((category) => ({
      ...category,
      budgeted: roundMoney(category.budgeted),
      spent: roundMoney(category.spent),
      remaining: roundMoney(category.remaining),
    })),
    sources: scope.sources.map((source) => ({
      ...source,
      totalBudget: roundMoney(source.totalBudget),
    })),
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
