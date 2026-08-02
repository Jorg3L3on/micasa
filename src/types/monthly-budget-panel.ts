export type MonthlyBudgetAllocationRow = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  walletId: number;
  walletName: string;
  walletProviderIconKey: string | null;
  walletAssignee: { id: number; name: string } | null;
  budgeted: number;
  spent: number;
  remaining: number;
  percentUsed: number;
};

export type MonthlyBudgetSourceSummary = {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'CUSTOM';
  totalBudget: number;
};

export type MonthlyBudgetScope = {
  totalBudget: number;
  spent: number;
  available: number;
  allocations: MonthlyBudgetAllocationRow[];
  sources: MonthlyBudgetSourceSummary[];
};

export type MonthlyBudgetPanelResult = {
  first: MonthlyBudgetScope;
  second: MonthlyBudgetScope;
};

export const MONTHLY_BUDGET_CATEGORY_ACCENTS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-orange-500',
] as const;
