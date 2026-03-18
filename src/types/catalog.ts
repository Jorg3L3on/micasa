/**
 * Shared catalog/list types used across pages and components.
 * Single source of truth for API response shapes and form options.
 */

export type CategoryOption = {
  id: number;
  name: string;
  description?: string;
};

export type PaymentMethodOption = {
  id: number;
  name: string;
  type?: string;
  amount?: number;
  credit_limit?: number | null;
  available_credit?: number | null;
};

export type ExpenseListItem = {
  id: number;
  name: string;
  category: string;
  categoryId: number | null;
  defaultAmount: number | null;
  paymentMethod: string;
  paymentMethodId: number;
  active: boolean;
};

export type TransactionRow = {
  id: number;
  date: string;
  description: string;
  amount: number | string;
  category: string;
  paymentMethod: string;
  type?: 'income' | 'expense';
  is_paid: boolean;
  due_day?: number | null;
};

export type ExpenseTemplateListItem = {
  id: number;
  name: string;
  category: string;
  suggestedAmount: number | null;
  paymentMethod: string | null;
  paymentMethodId: number | null;
  active: boolean;
  totalEstimatedAmount?: number;
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
  amount: number;
};

export type BudgetListItem = {
  id: number;
  name: string;
  allocated_amount: number;
  remaining_amount: number;
  spent_amount: number;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  allocations: BudgetAllocationItem[];
};

export type WalletListItem = {
  id: number;
  name: string;
  amount: number;
  credit_limit?: number | null;
  type: string;
  active: boolean;
  cutoff_day: number | null;
  due_day: number | null;
  spent_amount: number;
  remaining_amount: number;
};

export type CreditCardListItem = WalletListItem & {
  available_credit: number | null;
};

export type DuePaymentItem = {
  walletId: number;
  walletName: string;
  walletType: string;
  dueDay: number;
  nextDuePayment: number;
  statementDueDate: string;
};

export type CreditCardPaymentListItem = {
  id: number;
  amount: number;
  paid_at: string;
  note: string | null;
  source_wallet_id: number;
  source_wallet_name: string;
  credit_card_wallet_id: number;
  credit_card_wallet_name: string;
};

export type CreditCardStatementPurchaseItem = {
  id: number;
  description: string;
  amount: number;
  payment_date: string;
  category: string;
};

export type CreditCardStatementResponse = {
  credit_card_id: number;
  name: string;
  type: string;
  current_balance: number;
  credit_limit: number | null;
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
  payments_since_last_cutoff: number;
  payments_applied_to_statement: number;
  next_due_payment: number;
  current_cycle_purchases: number;
  current_cycle_payments: number;
  statement_purchases: CreditCardStatementPurchaseItem[];
  current_cycle_purchase_items: CreditCardStatementPurchaseItem[];
  payment_history: CreditCardPaymentListItem[];
};
