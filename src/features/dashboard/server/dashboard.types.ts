import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  DashboardBudgetSummary,
  DashboardFundingWalletBreakdownItem,
  PeriodView,
} from '@/types/dashboard';

export type { PeriodView };

export type DashboardAlertTarget = {
  path: string;
  query?: Record<string, string | number>;
};

export type DashboardAlert = {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  target: DashboardAlertTarget;
  fingerprint: string;
};

export type DashboardUpcomingObligation = {
  id: number;
  source: 'expense' | 'loan_payment';
  description: string;
  amount: number;
  is_paid: boolean;
  dueDate: string;
  dueDay: number;
  category: string;
  categoryIcon: string | null;
  loanId?: number;
  loanName?: string;
  lender?: string;
  paymentSource?: 'WALLET' | 'PAYROLL_DEDUCTION';
  sourceWalletId?: number | null;
};

export type DashboardRecentActivityItem = {
  id: string;
  type: 'expense_added' | 'income_added' | 'loan_payment_paid';
  description: string;
  amount: number;
  timestamp: string;
  user: string | null;
  meta: string;
};

export type DashboardResponseDto = {
  period: {
    view: PeriodView;
    year: number;
    month: number;
    period: 'FIRST' | 'SECOND';
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    totalPaid: number;
    totalUnpaid: number;
  };
  availableVsCommitted: {
    libre: number;
    pagado: number;
    pendiente: number;
  };
  periodCategoryBreakdown: Array<{
    category: string;
    categoryIcon: string | null;
    total: number;
  }>;
  fundingWalletBalanceTotal: number;
  fundingWalletBreakdown: DashboardFundingWalletBreakdownItem[];
  fundingNetVsPendingExpense: number;
  creditWalletDebtTotal: number;
  creditWalletAvailableTotal: number;
  planningCardPayments?: { total: number; count: number } | null;
  planningCardStatementDue?: { total: number; cardCount: number } | null;
  planningLoanPayments?: {
    total: number;
    paidTotal: number;
    pendingTotal: number;
    count: number;
    pendingCount: number;
  } | null;
  planningPayrollLoanDeduction?: { total: number; count: number } | null;
  budgetSummary: DashboardBudgetSummary;
  upcomingObligations: DashboardUpcomingObligation[];
  recentActivity: DashboardRecentActivityItem[];
  incomeBreakdown: {
    byPerson: Array<{
      userId: number;
      userName: string;
      amount: number;
      percentage: number;
    }>;
    totalIncome: number;
  };
  expenseHealth: {
    totalOverdueAmount: number;
    percentCommitted: number;
    largestExpense: {
      description: string;
      amount: number;
      category: string;
      categoryIcon: string | null;
    } | null;
  };
  fixedVsVariable: {
    totalFixed: number;
    totalVariable: number;
    ratio: string;
  };
  periodComparison: {
    currentIncome: number;
    currentExpense: number;
    previousIncome: number;
    previousExpense: number;
    incomeDiff: number;
    expenseDiff: number;
  };
  alerts: DashboardAlert[];
};

export type GetDashboardDataParams = {
  ownerFilter: OwnerFilter;
  view?: PeriodView;
  month?: string | null;
  year?: string | null;
  period?: 'FIRST' | 'SECOND' | null;
};

export type ResolvedDashboardPeriod = {
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
};
