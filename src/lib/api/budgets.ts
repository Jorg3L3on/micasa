'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { CreateBudgetInput, AllocationInput, Step1Values } from '@/schemas/budget.schema';
import type { BudgetPeriodItem, BudgetHistoryGroup, BudgetListItem } from '@/types/catalog';
import type { ExpenseFeedItem } from '@/types/expenses-feed';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function fetchActivePeriods(context?: FinanceContextType): Promise<BudgetPeriodItem[]> {
  return clientFetchFromApi<BudgetPeriodItem[]>('/api/budgets', undefined, context);
}

export type BudgetAllocationExpenseGroup = {
  allocation_id: number;
  expenses: ExpenseFeedItem[];
};

export async function fetchBudgetPeriodExpenseGroups(
  periodId: number,
  context?: FinanceContextType,
): Promise<BudgetAllocationExpenseGroup[]> {
  const response = await clientFetchFromApi<{ groups: BudgetAllocationExpenseGroup[] }>(
    `/api/budgets/periods/${periodId}/expenses`,
    undefined,
    context,
  );
  return response.groups;
}

export async function fetchBudgetHistory(
  year: number,
  month: number,
  context?: FinanceContextType,
): Promise<BudgetHistoryGroup[]> {
  return clientFetchFromApi<BudgetHistoryGroup[]>(
    `/api/budgets/history?year=${year}&month=${month}`,
    undefined,
    context,
  );
}

export async function fetchBudgetTemplates(context?: FinanceContextType): Promise<BudgetListItem[]> {
  return clientFetchFromApi<BudgetListItem[]>('/api/budget-templates', undefined, context);
}

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

export async function updateBudgetTemplate(
  id: number,
  data: Step1Values,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, context);
}

export async function setBudgetActive(
  id: number,
  active: boolean,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/budgets/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
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
