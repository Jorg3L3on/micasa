'use client';

import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

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
