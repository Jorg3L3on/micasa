'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { CreateBudgetInput, AllocationInput } from '@/schemas/budget.schema';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

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
