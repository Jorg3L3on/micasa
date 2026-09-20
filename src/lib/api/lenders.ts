'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { CreateLenderInput, PayLenderInput } from '@/schemas/lender.schema';
import type {
  LenderDetail,
  LenderListItem,
  PayLenderResult,
} from '@/types/lenders';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function listLenders(context?: FinanceContextType) {
  return clientFetchFromApi<LenderListItem[]>(
    '/api/lenders',
    undefined,
    context,
  );
}

export async function createLender(
  data: CreateLenderInput,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<LenderListItem>(
    '/api/lenders',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function getLender(
  lenderId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<LenderDetail>(
    `/api/lenders/${lenderId}`,
    undefined,
    context,
  );
}

export async function payLender(
  lenderId: number,
  data: PayLenderInput,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<PayLenderResult>(
    `/api/lenders/${lenderId}/pay`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function undoLenderPayment(
  lenderId: number,
  paymentId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<LenderDetail>(
    `/api/lenders/${lenderId}/payments/${paymentId}`,
    {
      method: 'DELETE',
    },
    context,
  );
}
