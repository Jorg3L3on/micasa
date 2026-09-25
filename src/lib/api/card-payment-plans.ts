'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { PlannerDuePaymentsResponse } from '@/types/catalog';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function getPlannerDuePayments(
  year: number,
  month: number,
  context?: FinanceContextType,
) {
  const ym = String(month).padStart(2, '0');
  return clientFetchFromApi<PlannerDuePaymentsResponse>(
    `/api/wallets/due-payments?year=${year}&month=${ym}`,
    undefined,
    context,
  );
}

export type CardPaymentPlanScopePayload = {
  scope?: 'this_cycle' | 'n_cycles' | 'until_date';
  cycleCount?: number;
  validUntil?: string;
};

export async function upsertFortnightCardPaymentPlan(
  fortnightId: number,
  data: { walletId: number; plannedAmount: number } & CardPaymentPlanScopePayload,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<{
    walletId: number;
    fortnightId: number;
    plannedAmount: number;
  }>(`/api/fortnights/${fortnightId}/card-payment-plans`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, context);
}

export async function declareFortnightCardPeriodZero(
  fortnightId: number,
  walletId: number,
  context?: FinanceContextType,
  scope?: CardPaymentPlanScopePayload,
) {
  return clientFetchFromApi<{
    walletId: number;
    fortnightId: number;
    plannedAmount: number;
    declaredZero: boolean;
  }>(`/api/fortnights/${fortnightId}/card-payment-plans`, {
    method: 'PUT',
    body: JSON.stringify({
      walletId,
      declareZero: true,
      scope: scope?.scope ?? 'this_cycle',
      cycleCount: scope?.cycleCount,
      validUntil: scope?.validUntil,
    }),
  }, context);
}

export async function clearFortnightCardPaymentPlan(
  fortnightId: number,
  walletId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<{ walletId: number; fortnightId: number }>(
    `/api/fortnights/${fortnightId}/card-payment-plans?walletId=${walletId}`,
    { method: 'DELETE' },
    context,
  );
}
