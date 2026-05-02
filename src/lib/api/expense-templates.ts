'use client';

import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function createExpenseTemplate(
  data: {
    name: string;
    categoryId: number;
    suggestedAmount?: number | null;
    defaultAmount?: number | null;
    paymentMethodId?: number | null;
    active?: boolean;
    expenseIds?: number[];
    dueDayFirst?: number | null;
    dueDaySecond?: number | null;
    cutoffDay?: number | null;
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
    dueDayFirst?: number | null;
    dueDaySecond?: number | null;
    cutoffDay?: number | null;
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
