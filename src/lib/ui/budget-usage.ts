import type { StatusTone } from '@/lib/status-tone';
import type { MonthlyBudgetScope } from '@/types/monthly-budget-panel';

/** Whole percent of the fortnight budget already spent; 0 without a budget. */
export const getBudgetUsedPercent = (
  scope: Pick<MonthlyBudgetScope, 'totalBudget' | 'spent'>,
): number =>
  scope.totalBudget > 0
    ? Math.round((scope.spent / scope.totalBudget) * 100)
    : 0;

/** Tone of the "% usado" badge: red over budget, amber from 85 %. */
export const getBudgetUsedTone = (
  percent: number,
): Extract<StatusTone, 'expense' | 'pending' | 'success'> =>
  percent > 100 ? 'expense' : percent >= 85 ? 'pending' : 'success';
