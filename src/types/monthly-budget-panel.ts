export type MonthlyBudgetAllocationRow = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  walletId: number | null;
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
