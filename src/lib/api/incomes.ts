'use client';

import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export type FortnightIncomeDto = {
  id: number;
  amount: number;
  source: string | null;
  received_at: string;
  fortnight_id: number;
  income_template_id: number | null;
  wallet_id: number | null;
  category_id: number | null;
};

export type IncomeTemplateDto = {
  id: number;
  name: string;
  suggestedAmount: number | null;
  source: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
  active: boolean;
  userId: number | null;
  userName: string | null;
};

export async function getFortnightIncomes(
  fortnightId: number,
  context?: FinanceContextType,
): Promise<FortnightIncomeDto[]> {
  return clientFetchFromApi<FortnightIncomeDto[]>(
    `/api/incomes?fortnightId=${fortnightId}`,
    undefined,
    context,
  );
}

export async function listIncomeTemplates(
  context?: FinanceContextType,
): Promise<IncomeTemplateDto[]> {
  return clientFetchFromApi<IncomeTemplateDto[]>(
    '/api/income-templates',
    undefined,
    context,
  );
}

export async function createWalletIncome(
  walletId: number,
  data: {
    date: string;
    amount: number;
    source: string;
    category_id: number;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/wallets/${walletId}/incomes`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function createIncome(
  data: {
    fortnight_id: number;
    amount: number;
    source?: string | null;
    received_at: string;
    transfer_from_user_id?: number;
    income_template_id?: number | null;
    wallet_id: number;
    category_id: number;
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
  options?: {
    wallet_id?: number | null;
    force_wallet_credit?: boolean;
    category_id?: number;
  },
) {
  const payload: {
    amount: number;
    wallet_id?: number | null;
    force_wallet_credit?: boolean;
    category_id?: number;
  } = { amount };
  if (options && 'wallet_id' in options) {
    payload.wallet_id = options.wallet_id;
  }
  if (options?.force_wallet_credit === true) {
    payload.force_wallet_credit = true;
  }
  if (options?.category_id != null) {
    payload.category_id = options.category_id;
  }

  return clientFetchFromApi(`/api/incomes?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, context);
}

export async function createIncomeTemplate(
  data: {
    name: string;
    suggestedAmount?: number | null;
    source?: string | null;
    categoryId: number;
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
    categoryId?: number;
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
