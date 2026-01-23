'use client';

// Client-side API helpers
export function getClientApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin;
}

export async function clientFetchFromApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Failed to fetch from ${endpoint}`;
    try {
      const error = await res.json();
      if (error.error) {
        errorMessage = error.error;
      } else if (error.details && Array.isArray(error.details)) {
        errorMessage = error.details.map((d: any) => d.message || d).join(', ');
      }
    } catch {
      // If JSON parsing fails, use default message
    }
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    throw error;
  }

  return res.json();
}

export async function createCategory(data: {
  name: string;
  description?: string;
}) {
  return clientFetchFromApi('/api/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: number,
  data: { name?: string; description?: string },
) {
  return clientFetchFromApi(`/api/categories?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number) {
  return clientFetchFromApi(`/api/categories?id=${id}`, {
    method: 'DELETE',
  });
}

export async function createPaymentMethod(data: {
  name: string;
  type?: 'CARD' | 'CASH';
}) {
  return clientFetchFromApi('/api/payment-methods', {
    method: 'POST',
    body: JSON.stringify({ ...data, type: data.type || 'CARD' }),
  });
}

export async function updatePaymentMethod(
  id: number,
  data: { name?: string; type?: 'CARD' | 'CASH' },
) {
  return clientFetchFromApi(`/api/payment-methods?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePaymentMethod(id: number) {
  return clientFetchFromApi(`/api/payment-methods?id=${id}`, {
    method: 'DELETE',
  });
}

// Expense catalog helpers
export async function createExpense(data: {
  name: string;
  categoryId: number;
  defaultAmount?: number | null;
  paymentMethodId: number;
  active?: boolean;
}) {
  return clientFetchFromApi('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExpense(
  id: number,
  data: {
    name?: string;
    categoryId?: number;
    defaultAmount?: number | null;
    paymentMethodId?: number;
    active?: boolean;
  },
) {
  return clientFetchFromApi(`/api/expenses?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExpense(id: number) {
  return clientFetchFromApi(`/api/expenses?id=${id}`, {
    method: 'DELETE',
  });
}

// ExpenseTemplate catalog helpers
export async function createExpenseTemplate(data: {
  name: string;
  categoryId: number;
  defaultAmount?: number | null;
  paymentMethodId?: number | null;
  active?: boolean;
  expenseIds?: number[];
}) {
  return clientFetchFromApi('/api/expense-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExpenseTemplate(
  id: number,
  data: {
    name?: string;
    categoryId?: number;
    defaultAmount?: number | null;
    paymentMethodId?: number | null;
    active?: boolean;
    expenseIds?: number[];
  },
) {
  return clientFetchFromApi(`/api/expense-templates?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExpenseTemplate(id: number) {
  return clientFetchFromApi(`/api/expense-templates?id=${id}`, {
    method: 'DELETE',
  });
}

// Fortnight catalog helpers
export async function createFortnight(data: {
  name: string;
  startDay: number;
  endDay: number;
  active?: boolean;
}) {
  return clientFetchFromApi('/api/fortnights', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFortnight(
  id: number,
  data: {
    name?: string;
    startDay?: number;
    endDay?: number;
    active?: boolean;
  },
) {
  return clientFetchFromApi(`/api/fortnights?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFortnight(id: number) {
  return clientFetchFromApi(`/api/fortnights?id=${id}`, {
    method: 'DELETE',
  });
}

// Expense paid status helpers
export async function updateExpensePaidStatus(id: number, paid: boolean) {
  return clientFetchFromApi(`/api/expenses/${id}/paid`, {
    method: 'PATCH',
    body: JSON.stringify({ paid }),
  });
}

// Fortnight override amount helpers
export async function updateFortnightOverrideAmount(
  id: number,
  data: {
    amount: number;
    year: number;
    month: number;
  },
) {
  return clientFetchFromApi(`/api/fortnights/${id}/override-amount`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Transaction/Expense amount helpers
export async function updateExpenseAmount(id: number, amount: number) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  });
}

// Delete expense transaction helper
export async function deleteTransaction(id: number) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'DELETE',
  });
}

// Create expense transaction helper
export async function createExpenseTransaction(data: {
  fortnight_id: number;
  category_id: number;
  description: string;
  amount: number;
  payment_method_id: number;
  is_paid?: boolean;
  payment_date?: string | null;
  expense_template_id?: number | null;
}) {
  return clientFetchFromApi('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
