'use client';

import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

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

export async function updateExpenseAmount(
  id: number,
  amount: number,
  context?: FinanceContextType,
  wallet_id?: number | null,
) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ amount, ...(wallet_id !== undefined ? { wallet_id } : {}) }),
  }, context);
}

export async function deleteTransaction(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'DELETE',
  }, context);
}

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
