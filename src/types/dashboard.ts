export type PeriodView = 'month' | 'biweekly';

export type DashboardBudgetSummary = {
  totalBudget: number;
  spent: number;
  available: number;
  usedPercent: number;
  categories: Array<{
    id: number;
    name: string;
    icon: string | null;
    spent: number;
    percentOfBudget: number;
  }>;
  sources: Array<{
    frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'CUSTOM';
    totalBudget: number;
  }>;
};

export type DashboardFundingWalletBreakdownItem = {
  id: number;
  name: string;
  type: 'CASH' | 'DEBIT_CARD';
  amount: number;
};

export type DashboardData = {
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
  /** Saldos en billeteras efectivo + débito (activas). */
  fundingWalletBalanceTotal: number;
  fundingWalletBreakdown: DashboardFundingWalletBreakdownItem[];
  /** Misma lógica que planificación: efectivo/débito menos pendiente del periodo en efectivo/débito. */
  fundingNetVsPendingExpense: number;
  /** Saldo utilizado (campo amount) en TC + tiendas departamentales. */
  creditWalletDebtTotal: number;
  /** Suma de (límite − saldo) en tarjetas con límite definido. */
  creditWalletAvailableTotal: number;
  /** Pagos a TC sin gasto duplicado, ya incluidos en gastos/balance del periodo. */
  planningCardPayments?: {
    total: number;
    count: number;
  } | null;
  /** Pendiente de pago al estado de cuenta en el periodo (misma lógica que planificación). */
  planningCardStatementDue?: {
    total: number;
    cardCount: number;
  } | null;
  /** Pagos de préstamos incluidos en planificación del periodo. */
  planningLoanPayments?: {
    total: number;
    paidTotal: number;
    pendingTotal: number;
    count: number;
    pendingCount: number;
  } | null;
  /** Deducciones de nómina pendientes (préstamos de nómina). */
  planningPayrollLoanDeduction?: {
    total: number;
    count: number;
  } | null;
  /** Cuotas de préstamo pendientes pagadas desde billetera. */
  planningWalletLoanDue?: {
    total: number;
    count: number;
  } | null;
  budgetSummary: DashboardBudgetSummary;
  upcomingObligations: Array<{
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
  }>;
  recentActivity: Array<{
    id: string;
    type: 'expense_added' | 'income_added' | 'loan_payment_paid';
    description: string;
    amount: number;
    timestamp: string;
    user: string | null;
    meta: string;
  }>;
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
  alerts: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
    target: {
      path: string;
      query?: Record<string, string | number>;
    };
    fingerprint: string;
  }>;
};
