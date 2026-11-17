export type MonthlyBudgetAllocationRow = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  walletId: number | null;
  walletName: string;
  walletProviderIconKey: string | null;
  walletAssignee: { id: number; name: string } | null;
  /** Effective amount for this quincena (after any one-quincena adjustment). */
  budgeted: number;
  /** What the template alone would give this quincena. */
  templateBudgeted: number;
  spent: number;
  remaining: number;
  percentUsed: number;
};

export type MonthlyBudgetSourceSummary = {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'CUSTOM';
  totalBudget: number;
};

/** A one-quincena exception to a budget template (MIC-I19). */
export type MonthlyBudgetAdjustment = {
  kind: 'PAUSE' | 'AMOUNTS';
  note: string | null;
};

/** One budget's share of the quincena, for the Ajustar overlay. */
export type MonthlyBudgetItem = {
  budgetId: number;
  name: string;
  frequency: MonthlyBudgetSourceSummary['frequency'];
  /** Prorated template amount for this quincena. */
  templateTotal: number;
  /** Effective amount for this quincena. */
  total: number;
  spent: number;
  /** Still reserved: Σ max(0, budgeted − spent) per category. */
  remaining: number;
  adjustment: MonthlyBudgetAdjustment | null;
  categories: Array<{
    categoryId: number;
    categoryName: string;
    walletId: number | null;
    templateBudgeted: number;
    budgeted: number;
    spent: number;
  }>;
};

export type MonthlyBudgetScope = {
  totalBudget: number;
  spent: number;
  /** Still reserved this quincena: Σ max(0, budgeted − spent) per category. */
  available: number;
  allocations: MonthlyBudgetAllocationRow[];
  sources: MonthlyBudgetSourceSummary[];
  budgets: MonthlyBudgetItem[];
};

export type MonthlyBudgetPanelResult = {
  first: MonthlyBudgetScope;
  second: MonthlyBudgetScope;
};
