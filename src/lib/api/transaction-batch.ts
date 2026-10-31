import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { FinanceContextType } from '@/types/finance-context';
import type { BatchPayloadItem } from '@/lib/transactions/batch-entry';
import type { BatchResponse } from '@/types/transaction-batch';

export type RecentExpenseItem = {
  id: number;
  description: string;
  amount: number;
  categoryId: number | null;
  walletId: number | null;
  category: string | null;
  paymentMethod: string | null;
};

/** One request for the whole batch; `idempotencyKey` makes a retry safe. */
export function saveTransactionBatch(
  items: BatchPayloadItem[],
  idempotencyKey: string,
  context?: FinanceContextType,
): Promise<BatchResponse> {
  return clientFetchFromApi<BatchResponse>(
    '/api/transactions/batch',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items }),
    },
    context,
  );
}

export async function listRecentExpenses(
  limit: number,
  context?: FinanceContextType,
): Promise<RecentExpenseItem[]> {
  const res = await clientFetchFromApi<{ items: RecentExpenseItem[] }>(
    `/api/expenses/recent?limit=${limit}`,
    undefined,
    context,
  );
  return res.items;
}
