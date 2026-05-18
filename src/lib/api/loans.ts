'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { CreateLoanInput } from '@/schemas/loan.schema';
import type {
  LoanListItem,
  LoanPaymentListItem,
  PlannerLoanPaymentsResponse,
} from '@/types/loans';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function listLoans(context?: FinanceContextType) {
  return clientFetchFromApi<LoanListItem[]>('/api/loans', undefined, context);
}

export async function createLoan(
  data: CreateLoanInput,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<LoanListItem>(
    '/api/loans',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function getPlannerLoanPayments(
  year: number,
  month: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<PlannerLoanPaymentsResponse>(
    `/api/loans/planner?year=${year}&month=${month}`,
    undefined,
    context,
  );
}

export async function updateLoanPaymentStatus(
  paymentId: number,
  data: {
    status: LoanPaymentListItem['status'];
    paidAt?: string | null;
    sourceWalletId?: number | null;
    note?: string | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi<LoanPaymentListItem>(
    `/api/loans/payments/${paymentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    context,
  );
}
