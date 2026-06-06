export type MonthlyBudgetCategoryRow = {
  id: number;
  name: string;
  icon: string | null;
  spent: number;
  percentOfBudget: number;
};

export type MonthlyBudgetPanelResult = {
  totalBudget: number;
  spent: number;
  available: number;
  categories: MonthlyBudgetCategoryRow[];
};

export const MONTHLY_BUDGET_CATEGORY_ACCENTS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-orange-500',
] as const;
