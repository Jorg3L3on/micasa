export type PeriodView = 'month' | 'biweekly';

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
  upcomingObligations: Array<{
    id: number;
    description: string;
    amount: number;
    is_paid: boolean;
    dueDate: string;
    dueDay: number;
    category: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'expense_added' | 'income_added';
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
    type: string;
    title: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
  }>;
};
