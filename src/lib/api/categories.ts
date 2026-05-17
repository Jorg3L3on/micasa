'use client';

import type { FinanceContextType } from '@/types/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function createCategory(
  data: { name: string; description?: string; icon?: string },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(
    '/api/categories',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function updateCategory(
  id: number,
  data: { name?: string; description?: string; icon?: string },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(
    `/api/categories?id=${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function deleteCategory(id: number, context?: FinanceContextType) {
  return clientFetchFromApi(
    `/api/categories?id=${id}`,
    { method: 'DELETE' },
    context,
  );
}
