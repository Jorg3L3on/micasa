'use client';

import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function upsertFortnightCardPaymentPlan(
  fortnightId: number,
  data: { walletId: number; plannedAmount: number },
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
