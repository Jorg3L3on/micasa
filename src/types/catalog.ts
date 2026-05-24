/**
 * Shared catalog/list types used across pages and components.
 * Single source of truth for API response shapes and form options.
 */
import type { WalletProviderIconKey } from '@/lib/wallet-provider-icons';

export type CategoryOption = {
  id: number;
  name: string;
  description?: string;
  icon?: string | null;
};

export type PaymentMethodOption = {
  id: number;
  name: string;
  provider_icon_key?: string | null;
  type?: string;
  amount?: number;
  credit_limit?: number | null;
  temporary_credit_limit?: number | null;
  available_credit?: number | null;
};

export type ExpenseListItem = {
  id: number;
  name: string;
  category: string;
  categoryIcon?: string | null;
  categoryId: number | null;
  defaultAmount: number | null;
  paymentMethod: string;
  paymentMethodId: number;
  active: boolean;
};

/** Wallet tipo Prisma `PaymentMethodType`; null = sin billetera (efectivo implícito). */
export type ExpenseWalletType =
  | 'CASH'
  | 'DEBIT_CARD'
  | 'CREDIT_CARD'
  | 'DEPARTMENT_STORE_CARD';

/** Gasto normal vs pago a TC registrado solo como movimiento de tarjeta (sin Expense). */
export type PlanningExpenseRowKind = 'expense' | 'card_payment';

export type TransactionRow = {
  id: number;
  date: string;
  description: string;
  amount: number | string;
  category: string;
  categoryIcon?: string | null;
  paymentMethod: string;
  wallet_id?: number | null;
  wallet_type?: ExpenseWalletType | null;
  /** Solo planificación: filas de pago a tarjeta no editables como gasto. */
  planning_row_kind?: PlanningExpenseRowKind;
  type?: 'income' | 'expense';
  is_paid: boolean;
  due_day?: number | null;
};

/** Desglose de cargos a TC / tienda en resumen de planificación (`exclude_credit_installment`). */
export type PlannerCardChargesSummary = {
  total: number;
  paid: number;
  unpaid: number;
  expenseCount: number;
};

/** Pagos a tarjeta contados en planificación sin fila de gasto vinculada. */
export type PlannerOrphanCardPaymentsSummary = {
  total: number;
  count: number;
};

/** Monto a pagar al estado de cuenta en la quincena (pestaña Pagos tarjeta). */
export type PlannerCardStatementDueSummary = {
  total: number;
  cardCount: number;
};

/** Una billetera efectivo/débito incluida en el desglose del resumen. */
export type FundingWalletBreakdownItem = {
  id: number;
  name: string;
  amount: number;
  /** `PaymentMethodType`, ej. CASH | DEBIT_CARD */
  type: string;
};

/** Respuesta de GET /api/reports?type=summary: saldos activos Efectivo+Débito y neto vs solo lo pendiente (no pagado) del período. */
export type ReportsSummaryFundingFields = {
  fundingWalletBalanceTotal: number;
  fundingNetVsPendingExpense: number;
  fundingWalletBreakdown: FundingWalletBreakdownItem[];
};

export type ExpenseTemplateListItem = {
  id: number;
  name: string;
  category: string;
  categoryIcon?: string | null;
  suggestedAmount: number | null;
  paymentMethod: string | null;
  paymentMethodId: number | null;
  active: boolean;
  totalEstimatedAmount?: number;
  dueDayFirst: number | null;
  dueDaySecond: number | null;
  /** Derived for compatibility: first non-null per-quincena due, then legacy `due_day`. */
  dueDay: number | null;
  cutoffDay: number | null;
  isRecurring: boolean;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
  isSubscription: boolean;
};

export type IncomeTemplateListItem = {
  id: number;
  name: string;
  suggestedAmount: number | null;
  source: string | null;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
  active: boolean;
  userId: number | null;
  userName: string | null;
};

export type BudgetAllocationItem = {
  id: number;
  wallet_id: number;
  wallet_name: string;
  category_id: number;
  category_name: string;
  category_icon?: string | null;
  amount: number;
};

// Template definition returned by GET /api/budget-templates
export type BudgetListItem = {
  id: number;
  name: string;
  allocated_amount: number;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  recurrent: boolean;
  allocations: BudgetAllocationItem[];
};

// Active period returned by GET /api/budgets
export type BudgetPeriodItem = {
  period_id: number;
  budget_id: number;
  name: string;
  frequency: string;
  start_date: string;
  end_date: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  active: boolean;
  recurrent: boolean;
  allocations: BudgetAllocationItem[];
};

// History group returned by GET /api/budgets/history
export type BudgetHistoryGroup = {
  budget_id: number;
  name: string;
  frequency: string;
  allocated_amount: number;
  periods: Array<{
    period_id: number;
    start_date: string;
    end_date: string;
    allocated_amount: number;
    spent_amount: number;
    remaining_amount: number;
  }>;
};

export type WalletListItem = {
  id: number;
  name: string;
  provider_icon_key: WalletProviderIconKey | null;
  amount: number;
  credit_limit?: number | null;
  /** Tope promocional temporal por encima de la línea (ej. DiDi); MiCasa usa max(contrato, este). */
  temporary_credit_limit?: number | null;
  temporary_credit_limit_as_of?: string | null;
  type: string;
  active: boolean;
  cutoff_day: number | null;
  due_day: number | null;
  spent_amount: number;
  remaining_amount: number;
  /** Solo billeteras de casa: miembro atribuido; null = compartida. */
  assignee_user_id: number | null;
  assignee: { id: number; name: string } | null;
};

export type CreditCardListItem = WalletListItem & {
  available_credit: number | null;
};

/** GET /api/credit-cards/:id/statement-imports */
export type CreditCardStatementImportListItem = {
  id: number;
  provider: string;
  created_at: string;
  period_start: string | null;
  period_end: string | null;
  account_number: string | null;
  statement_issue_date: string | null;
  payment_due_date: string | null;
  total_due: number | null;
  minimum_payment: number | null;
  file_name: string | null;
  has_file: boolean;
  expense_count: number;
  parse_warnings: string[];
};

/** POST /api/credit-cards/:id/statement-imports (Mercado Pago) */
export type MercadoPagoStatementImportResponse = {
  import_id: number;
  expenses_created: number;
  duplicates_skipped: number;
  lines_skipped: number;
  warnings: string[];
};

export type DuePaymentItem = {
  walletId: number;
  walletName: string;
  walletType: string;
  dueDay: number;
  cutoff_day: number;
  nextDuePayment: number;
  /**
   * Pagos a tarjeta (CreditCardPayment) que cuentan contra el estado de cuenta
   * de esta ventana; en fila “pagada” es el monto liquidado hacia ese corte.
   */
  paymentsAppliedToStatement: number;
  statementDueDate: string;
  /** Deuda actual en la billetera tarjeta (para tope de pago y “saldo total”). */
  outstandingBalance: number;
  /** Monto que el usuario planea pagar en esta quincena; null = usar sugerido (`nextDuePayment`). */
  plannedPayment?: number | null;
};

/** GET /api/wallets/due-payments?year=&month= — planificación mensual por quincena */
export type PlannerDuePaymentsResponse = {
  first: DuePaymentItem[];
  second: DuePaymentItem[];
};

export type LiquidityProjectionObligationSource =
  | 'credit_card_statement'
  | 'unpaid_expense'
  | 'expense_template'
  | 'loan_payment';

/** Respuesta de GET /api/wallets/liquidity-projection */
export type LiquidityProjectionObligationItem = {
  source: LiquidityProjectionObligationSource;
  wallet_id: number;
  wallet_name: string;
  wallet_type: string;
  statement_start: string;
  statement_end: string;
  statement_due_date: string;
  last_statement_balance: number;
  payments_applied_to_statement: number;
  next_due_payment: number;
  stress_adjustment?: number;
  expense_id?: number;
  expense_description?: string;
  expense_template_id?: number;
  template_name?: string;
  loan_payment_id?: number;
  loan_id?: number;
  loan_name?: string;
  lender?: string;
  payment_source?: string;
  is_estimate?: boolean;
  fortnight_id?: number;
};

export type LiquidityProjectionMilestone = {
  due_date: string;
  is_past_due: boolean;
  obligations: LiquidityProjectionObligationItem[];
  total_due: number;
  cumulative_due_through_date: number;
  funding_total: number;
  liquidity_headroom: number;
};

export type LiquidityProjectionSummary = {
  total_obligations_due_on_or_before_until: number;
  funding_total: number;
  expected_income_total_on_or_before_until: number;
  net_liquidity_versus_obligations: number;
  shortfall_versus_funding: number;
  first_cumulative_shortfall_date: string | null;
  net_liquidity_versus_obligations_including_income: number;
  shortfall_versus_funding_and_income: number;
  first_projected_shortfall_date: string | null;
};

export type LiquidityProjectionOptionsEcho = {
  stress_cycle_percent: number;
  include_unpaid_expenses: boolean;
  include_expense_templates: boolean;
};

export type LiquidityMonthlySeriesItem = {
  month_key: string;
  msi_debt_total: number;
  loan_payment_total: number;
  expected_income_total: number;
  expense_template_total: number;
  other_debt_components_total: number;
  monthly_remaining: number;
};

export type LiquidityCardUtilizationRiskLevel =
  | 'safe'
  | 'danger'
  | 'unrated_no_limit';

export type LiquidityCardUtilizationItem = {
  card_id: number;
  card_name: string;
  card_type: string;
  used_amount: number;
  credit_limit: number | null;
  utilization_percent: number | null;
  risk_level: LiquidityCardUtilizationRiskLevel;
  is_danger: boolean;
};

export type LiquidityCardUtilizationSummary = {
  cards: LiquidityCardUtilizationItem[];
  dangerous_count: number;
  unrated_count: number;
};

export type LiquidityProjectionResponse = {
  as_of: string;
  until: string;
  funding_wallets: Array<{
    id: number;
    name: string;
    type: string;
    balance: number;
  }>;
  milestones: LiquidityProjectionMilestone[];
  summary: LiquidityProjectionSummary;
  assumptions: readonly string[];
  options: LiquidityProjectionOptionsEcho;
  monthly_series: LiquidityMonthlySeriesItem[];
  card_utilization_summary: LiquidityCardUtilizationSummary;
};

export type CreditCardPaymentListItem = {
  id: number;
  amount: number;
  paid_at: string;
  note: string | null;
  source_wallet_id: number;
  source_wallet_name: string;
  source_wallet_provider_icon_key: string | null;
  credit_card_wallet_id: number;
  credit_card_wallet_name: string;
};

export type CreditCardStatementPurchaseItem = {
  id: number;
  description: string;
  amount: number;
  payment_date: string;
  category: string;
  categoryIcon?: string | null;
  fortnight_id: number;
  fortnight_year: number;
  fortnight_month: number;
  fortnight_period: 'FIRST' | 'SECOND';
  credit_installment_current: number | null;
  credit_installment_total: number | null;
};

export type InstallmentProjectionMonthItem = {
  monthKey: string;
  label: string;
  total: number;
  cards: Array<{
    cardId: number;
    cardName: string;
    amount: number;
  }>;
};

export type CreditCardStatementResponse = {
  credit_card_id: number;
  name: string;
  type: string;
  current_balance: number;
  credit_limit: number | null;
  temporary_credit_limit: number | null;
  available_credit: number | null;
  cutoff_day: number;
  due_day: number;
  statement_start: string;
  statement_end: string;
  statement_due_date: string;
  current_cycle_start: string;
  current_cycle_end: string;
  outstanding_balance: number;
  last_statement_balance: number;
  imported_statement_total: number | null;
  payments_since_last_cutoff: number;
  payments_applied_to_statement: number;
  next_due_payment: number;
  minimum_payment: number | null;
  current_cycle_purchases: number;
  current_cycle_payments: number;
  statement_purchases: CreditCardStatementPurchaseItem[];
  current_cycle_purchase_items: CreditCardStatementPurchaseItem[];
  /** Gastos en cuotas pagados donde la cuota actual es menor que el total (aún quedan meses). */
  installment_active_purchases: CreditCardStatementPurchaseItem[];
  payment_history: CreditCardPaymentListItem[];
};
