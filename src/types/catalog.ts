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

export type FortnightListItem = {
  id: number;
  name: string;
  startDay: number;
  endDay: number;
  active: boolean;
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
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
