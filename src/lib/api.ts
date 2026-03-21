'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type {
  CreditCardPaymentListItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
  WalletListItem,
} from '@/types/catalog';
import { WalletFormValues } from '@/schemas/wallet.schema';
import type { CreateBudgetInput, AllocationInput } from '@/schemas/budget.schema';

type ApiErrorDetail = {
  message?: string;
} | string;

type ApiErrorResponse = {
  error?: string;
  details?: ApiErrorDetail[];
};

type ClientApiError = Error & {
  status?: number;
  details?: ApiErrorDetail[];
};

/**
 * Builds URLSearchParams for owner context (ownerType, ownerId).
 * Returns empty params if context is missing or invalid (e.g. id 0 before sync).
 * When empty params are sent, the API uses the session user.
 */
export function buildOwnerQuery(
  context?: FinanceContextType,
): URLSearchParams {
  if (!context || (context.type === 'user' && context.id === 0)) {
    return new URLSearchParams();
  }
  return new URLSearchParams({
    ownerType: context.type,
    ownerId: String(context.id),
  });
}

// Client-side API helpers
export function getClientApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin;
}

export async function clientFetchFromApi<T>(
  endpoint: string,
  options?: RequestInit,
  context?: FinanceContextType,
): Promise<T> {
  let url = endpoint;
  const ownerParams = buildOwnerQuery(context);
  if (ownerParams.toString()) {
    const separator = endpoint.includes('?') ? '&' : '?';
    url = `${endpoint}${separator}${ownerParams.toString()}`;
  }

  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Failed to fetch from ${endpoint}`;
    let errorDetails: ApiErrorDetail[] | undefined;
    try {
      const error = (await res.json()) as ApiErrorResponse;
      if (error.error) {
        errorMessage = error.error;
      }
      if (error.details && Array.isArray(error.details)) {
        errorDetails = error.details;
        // If we have details, use them for the message, but also preserve them
        if (errorDetails && errorDetails.length > 0) {
          errorMessage = error.details
            .map((detail) =>
              typeof detail === 'string' ? detail : (detail.message ?? 'Error'),
            )
            .join(', ');
        }
      }
    } catch {
      // If JSON parsing fails, use default message
    }
    const error = new Error(errorMessage) as ClientApiError;
    error.status = res.status;
    error.details = errorDetails;
    throw error;
  }

  return res.json();
}

export async function createCategory(
  data: { name: string; description?: string },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(
    '/api/categories',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function updateCategory(
  id: number,
  data: { name?: string; description?: string },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(
    `/api/categories?id=${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function deleteCategory(id: number, context?: FinanceContextType) {
  return clientFetchFromApi(
    `/api/categories?id=${id}`,
    { method: 'DELETE' },
    context,
  );
}

/** Fetches active wallets as payment method options for dropdowns (expenses, templates). */
export async function getPaymentMethodOptions(
  context?: FinanceContextType,
): Promise<PaymentMethodOption[]> {
  const wallets = await clientFetchFromApi<WalletListItem[]>(
    '/api/wallets',
    undefined,
    context,
  );
  return wallets
    .filter((w) => w.active)
    .map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      amount: w.amount,
      credit_limit: w.credit_limit ?? null,
      available_credit:
        w.credit_limit != null ? w.credit_limit - w.amount : null,
    }));
}

// ExpenseTemplate catalog helpers (API expects suggestedAmount; defaultAmount is alias for callers)
export async function createExpenseTemplate(
  data: {
    name: string;
    categoryId: number;
    suggestedAmount?: number | null;
    defaultAmount?: number | null;
    paymentMethodId?: number | null;
    active?: boolean;
    expenseIds?: number[];
    dueDay: number;
    cutoffDay: number;
    isRecurring: boolean;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    isSubscription: boolean;
  },
  context?: FinanceContextType,
) {
  const body = {
    ...data,
    suggestedAmount: data.suggestedAmount ?? data.defaultAmount ?? null,
  };
  return clientFetchFromApi('/api/expense-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  }, context);
}

export async function updateExpenseTemplate(
  id: number,
  data: {
    name?: string;
    categoryId?: number;
    suggestedAmount?: number | null;
    defaultAmount?: number | null;
    paymentMethodId?: number | null;
    active?: boolean;
    expenseIds?: number[];
    dueDay: number;
    cutoffDay: number;
    isRecurring: boolean;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    isSubscription: boolean;
  },
  context?: FinanceContextType,
) {
  const body = {
    ...data,
    ...(data.suggestedAmount !== undefined || data.defaultAmount !== undefined
      ? { suggestedAmount: data.suggestedAmount ?? data.defaultAmount ?? null }
      : {}),
  };
  return clientFetchFromApi(`/api/expense-templates?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, context);
}

export async function deleteExpenseTemplate(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/expense-templates?id=${id}`, {
    method: 'DELETE',
  }, context);
}

// Income template helpers
export async function createIncomeTemplate(
  data: {
    name: string;
    suggestedAmount?: number | null;
    source?: string | null;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    active?: boolean;
    userId?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/income-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function updateIncomeTemplate(
  id: number,
  data: {
    name?: string;
    suggestedAmount?: number | null;
    source?: string | null;
    appliesFirstFortnight?: boolean;
    appliesSecondFortnight?: boolean;
    active?: boolean;
    userId?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/income-templates?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, context);
}

export async function deleteIncomeTemplate(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/income-templates?id=${id}`, {
    method: 'DELETE',
  }, context);
}

export async function createIncome(
  data: {
    fortnight_id: number;
    amount: number;
    source?: string | null;
    received_at: string;
    transfer_from_user_id?: number;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/incomes', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function updateIncomeAmount(
  id: number,
  amount: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/incomes?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  }, context);
}

export type CreateMonthFortnightsResult = {
  message: string;
  created: Array<{ id: number; label: string; period: string }>;
  year: number;
  month: number;
  expensesCreated?: {
    firstFortnight: { count: number; names: string[] };
    secondFortnight: { count: number; names: string[] };
    total: number;
  };
  incomeCreated?: {
    firstFortnight: number;
    secondFortnight: number;
    total: number;
  };
};

export type CreatedMonth = { year: number; month: number };

export async function getCreatedMonths(
  context?: FinanceContextType,
): Promise<CreatedMonth[]> {
  return clientFetchFromApi<CreatedMonth[]>(
    '/api/fortnights/created-months',
    undefined,
    context,
  );
}

export async function createMonthFortnights(
  year: number,
  month: number,
  context?: FinanceContextType,
): Promise<CreateMonthFortnightsResult> {
  return clientFetchFromApi<CreateMonthFortnightsResult>(
    '/api/fortnights/create-month',
    {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    },
    context,
  );
}

/**
 * Wallets
 */

/** Create Wallet **/
export async function createWallet(
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/wallets', {
    method: 'POST',
    body: JSON.stringify({ ...data }),
  }, context);
}

/** Update Wallet **/
export async function updateWallet(
  id: number,
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data }),
  }, context);
}

/** Update Wallet Status */
export async function updateWalletStatus(id: number, status: boolean) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: status }),
  })
}

/** Delete Wallet **/
export async function deleteWallet(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'DELETE',
  }, context);
}

// Budget helpers
export async function createBudget(
  data: CreateBudgetInput,
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function deleteBudget(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/budgets/${id}`, {
    method: 'DELETE',
  }, context);
}

export async function updateBudgetAllocations(
  id: number,
  allocations: AllocationInput[],
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/budgets/${id}/allocations`, {
    method: 'PUT',
    body: JSON.stringify({ allocations }),
  }, context);
}

// Expense paid status helpers
export async function updateExpensePaidStatus(
  id: number,
  paid: boolean,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/expenses/${id}/paid`, {
    method: 'PATCH',
    body: JSON.stringify({ paid }),
  }, context);
}

// Fortnight override amount helpers
export async function updateFortnightOverrideAmount(
  id: number,
  data: {
    amount: number;
    year: number;
    month: number;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/fortnights/${id}/override-amount`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, context);
}

// Transaction/Expense amount helpers
export async function updateExpenseAmount(
  id: number,
  amount: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  }, context);
}

// Delete expense transaction helper
export async function deleteTransaction(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'DELETE',
  }, context);
}

// Create expense transaction helper
export async function createExpenseTransaction(
  data: {
    fortnight_id: number;
    category_id: number;
    description: string;
    amount: number;
    payment_method_id: number;
    is_paid?: boolean;
    payment_date?: string | null;
    expense_template_id?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function createCreditCard(
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/credit-cards', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function updateCreditCard(
  id: number,
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  const { amount, ...metadata } = data;
  void amount;
  return clientFetchFromApi(`/api/credit-cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(metadata),
  }, context);
}

export async function getCreditCardStatement(
  id: number,
  context?: FinanceContextType,
  asOf?: string,
) {
  const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  return clientFetchFromApi<CreditCardStatementResponse>(
    `/api/credit-cards/${id}/statement${query}`,
    undefined,
    context,
  );
}

export async function getCreditCardPayments(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardPaymentListItem[]>(
    `/api/credit-cards/${id}/payments`,
    undefined,
    context,
  );
}

export async function createCreditCardPayment(
  id: number,
  data: {
    source_wallet_id: number;
    amount: number;
    paid_at: string;
    note?: string | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/credit-cards/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function createCreditCardPurchase(
  creditCardId: number,
  data: {
    fortnight_id: number;
    category_id: number;
    description: string;
    amount: number;
    payment_date?: string | null;
    expense_template_id?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/credit-cards/${creditCardId}/purchase`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}
