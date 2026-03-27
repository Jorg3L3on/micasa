'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type {
  CreditCardPaymentListItem,
  CreditCardStatementImportListItem,
  CreditCardStatementResponse,
  LiquidityProjectionResponse,
  MercadoPagoStatementImportResponse,
  PaymentMethodOption,
  WalletListItem,
} from '@/types/catalog';
import { WalletFormValues } from '@/schemas/wallet.schema';
import type { CreateBudgetInput, AllocationInput } from '@/schemas/budget.schema';
import type {
  PantryReceiptDetailDto,
  PantryReceiptListItemDto,
} from '@/types/pantry-receipt';
import type { PantryInsightsDto } from '@/types/pantry-insights';
import type { PatchPantryReceiptInput } from '@/schemas/pantry-receipt.schema';
import type {
  CreatePantryProductInput,
  PatchPantryProductInput,
} from '@/schemas/pantry-product.schema';
import type { PantryProductDto } from '@/types/pantry-product';

type ApiErrorDetail = {
  message?: string;
} | string;

type ApiErrorResponse = {
  error?: string;
  details?: ApiErrorDetail[];
};

type ClientApiError = Error & {
  status?: number;
  details?: ApiErrorDetail[];
};

/**
 * Builds URLSearchParams for owner context (ownerType, ownerId).
 * Returns empty params if context is missing or invalid (e.g. id 0 before sync).
 * When empty params are sent, the API uses the session user.
 */
export function buildOwnerQuery(
  context?: FinanceContextType,
): URLSearchParams {
  if (!context || (context.type === 'user' && context.id === 0)) {
    return new URLSearchParams();
  }
  return new URLSearchParams({
    ownerType: context.type,
    ownerId: String(context.id),
  });
}

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
  context?: FinanceContextType,
): Promise<T> {
  let url = endpoint;
  const ownerParams = buildOwnerQuery(context);
  if (ownerParams.toString()) {
    const separator = endpoint.includes('?') ? '&' : '?';
    url = `${endpoint}${separator}${ownerParams.toString()}`;
  }

  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `No se pudo completar la solicitud (${endpoint})`;
    let errorDetails: ApiErrorDetail[] | undefined;
    try {
      const error = (await res.json()) as ApiErrorResponse;
      if (error.error) {
        errorMessage = error.error;
      }
      if (error.details && Array.isArray(error.details)) {
        errorDetails = error.details;
        // If we have details, use them for the message, but also preserve them
        if (errorDetails && errorDetails.length > 0) {
          errorMessage = error.details
            .map((detail) =>
              typeof detail === 'string'
                ? detail
                : (detail.message ?? 'Error en los datos enviados'),
            )
            .join(', ');
        }
      }
    } catch {
      // If JSON parsing fails, use default message
    }
    const error = new Error(errorMessage) as ClientApiError;
    error.status = res.status;
    error.details = errorDetails;
    throw error;
  }

  return res.json();
}

/**
 * POST multipart (e.g. file upload). Do not set Content-Type — the browser sets the boundary.
 */
export async function clientFetchMultipartJson<T>(
  endpoint: string,
  formData: FormData,
  context?: FinanceContextType,
): Promise<T> {
  let url = endpoint;
  const ownerParams = buildOwnerQuery(context);
  if (ownerParams.toString()) {
    const separator = endpoint.includes('?') ? '&' : '?';
    url = `${endpoint}${separator}${ownerParams.toString()}`;
  }

  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!res.ok) {
    let errorMessage = `No se pudo completar la solicitud (${endpoint})`;
    if (res.status === 413) {
      errorMessage =
        'El archivo supera el límite de tamaño del servidor o del proxy (p. ej. nginx, Vercel). Prueba en local, sube un CSV más pequeño o aumenta client_max_body_size / el límite de tu proveedor.';
    }
    let errorDetails: ApiErrorDetail[] | undefined;
    try {
      const error = (await res.json()) as ApiErrorResponse;
      if (error.error) {
        errorMessage = error.error;
      }
      if (error.details && Array.isArray(error.details)) {
        errorDetails = error.details;
        if (errorDetails && errorDetails.length > 0) {
          errorMessage = error.details
            .map((detail) =>
              typeof detail === 'string'
                ? detail
                : (detail.message ?? 'Error en los datos enviados'),
            )
            .join(', ');
        }
      }
    } catch {
      // keep default message (incl. 413 hint when JSON body is empty)
    }
    const err = new Error(errorMessage) as ClientApiError;
    err.status = res.status;
    err.details = errorDetails;
    throw err;
  }

  return res.json();
}

export async function listPantryReceipts(
  context?: FinanceContextType,
): Promise<PantryReceiptListItemDto[]> {
  return clientFetchFromApi<PantryReceiptListItemDto[]>(
    '/api/pantry/receipts',
    undefined,
    context,
  );
}

export async function getPantryInsights(
  context?: FinanceContextType,
): Promise<PantryInsightsDto> {
  return clientFetchFromApi<PantryInsightsDto>(
    '/api/pantry/insights',
    undefined,
    context,
  );
}

export async function uploadPantryReceipt(
  formData: FormData,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchMultipartJson<PantryReceiptDetailDto>(
    '/api/pantry/receipts',
    formData,
    context,
  );
}

export async function getPantryReceipt(
  id: number,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchFromApi<PantryReceiptDetailDto>(
    `/api/pantry/receipts/${id}`,
    undefined,
    context,
  );
}

export async function patchPantryReceipt(
  id: number,
  body: PatchPantryReceiptInput,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchFromApi<PantryReceiptDetailDto>(
    `/api/pantry/receipts/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function deletePantryReceipt(
  id: number,
  context?: FinanceContextType,
): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/pantry/receipts/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listPantryProducts(
  context?: FinanceContextType,
): Promise<PantryProductDto[]> {
  return clientFetchFromApi<PantryProductDto[]>(
    '/api/pantry/products',
    undefined,
    context,
  );
}

export async function createPantryProduct(
  body: CreatePantryProductInput,
  context?: FinanceContextType,
): Promise<PantryProductDto> {
  return clientFetchFromApi<PantryProductDto>(
    '/api/pantry/products',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function patchPantryProduct(
  id: number,
  body: PatchPantryProductInput,
  context?: FinanceContextType,
): Promise<PantryProductDto> {
  return clientFetchFromApi<PantryProductDto>(
    `/api/pantry/products/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function deletePantryProduct(
  id: number,
  context?: FinanceContextType,
): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/pantry/products/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function createCategory(
  data: { name: string; description?: string },
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
  data: { name?: string; description?: string },
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

/** Fetches active wallets as payment method options for dropdowns (expenses, templates). */
export async function getPaymentMethodOptions(
  context?: FinanceContextType,
): Promise<PaymentMethodOption[]> {
  const wallets = await clientFetchFromApi<WalletListItem[]>(
    '/api/wallets',
    undefined,
    context,
  );
  return wallets
    .filter((w) => w.active)
    .map((w) => {
      // API JSON may serialize Prisma Decimals as strings; coerce so UI math never uses + on strings.
      const amountNum = Number(w.amount);
      const limitNum =
        w.credit_limit != null ? Number(w.credit_limit) : null;
      const amount = Number.isFinite(amountNum) ? amountNum : 0;
      const credit_limit =
        limitNum != null && Number.isFinite(limitNum) ? limitNum : null;
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        amount,
        credit_limit,
        available_credit:
          credit_limit != null ? credit_limit - amount : null,
      };
    });
}

export type FetchLiquidityProjectionParams = {
  until?: string;
  omitZero?: boolean;
  stressCyclePercent?: number;
  includeUnpaid?: boolean;
  includeTemplates?: boolean;
};

const appendLiquiditySearchParams = (
  search: URLSearchParams,
  params: FetchLiquidityProjectionParams,
) => {
  if (params.until) {
    search.set('until', params.until);
  }
  if (params.omitZero === false) {
    search.set('omitZero', 'false');
  }
  if (
    params.stressCyclePercent != null &&
    params.stressCyclePercent > 0
  ) {
    search.set('stressCyclePercent', String(params.stressCyclePercent));
  }
  if (params.includeUnpaid === false) {
    search.set('includeUnpaid', 'false');
  }
  if (params.includeTemplates === true) {
    search.set('includeTemplates', 'true');
  }
};

export async function fetchLiquidityProjection(
  params: FetchLiquidityProjectionParams,
  context?: FinanceContextType,
): Promise<LiquidityProjectionResponse> {
  const search = new URLSearchParams();
  appendLiquiditySearchParams(search, params);
  const ownerParams = buildOwnerQuery(context);
  ownerParams.forEach((v, k) => {
    search.set(k, v);
  });
  const qs = search.toString();
  const path = `/api/wallets/liquidity-projection${qs ? `?${qs}` : ''}`;
  return clientFetchFromApi<LiquidityProjectionResponse>(path, undefined);
}

export const downloadLiquidityProjectionCsv = async (
  params: FetchLiquidityProjectionParams,
  context?: FinanceContextType,
): Promise<void> => {
  const search = new URLSearchParams();
  appendLiquiditySearchParams(search, params);
  search.set('format', 'csv');
  const ownerParams = buildOwnerQuery(context);
  ownerParams.forEach((v, k) => {
    search.set(k, v);
  });
  const qs = search.toString();
  const path = `/api/wallets/liquidity-projection?${qs}`;
  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, { credentials: 'include' });
  if (!res.ok) {
    let message = 'No se pudo descargar el CSV';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'liquidez.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ExpenseTemplate catalog helpers (API expects suggestedAmount; defaultAmount is alias for callers)
export async function createExpenseTemplate(
  data: {
    name: string;
    categoryId: number;
    suggestedAmount?: number | null;
    defaultAmount?: number | null;
    paymentMethodId?: number | null;
    active?: boolean;
    expenseIds?: number[];
    dueDayFirst?: number | null;
    dueDaySecond?: number | null;
    cutoffDay?: number | null;
    isRecurring: boolean;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    isSubscription: boolean;
  },
  context?: FinanceContextType,
) {
  const body = {
    ...data,
    suggestedAmount: data.suggestedAmount ?? data.defaultAmount ?? null,
  };
  return clientFetchFromApi('/api/expense-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  }, context);
}

export async function updateExpenseTemplate(
  id: number,
  data: {
    name?: string;
    categoryId?: number;
    suggestedAmount?: number | null;
    defaultAmount?: number | null;
    paymentMethodId?: number | null;
    active?: boolean;
    expenseIds?: number[];
    dueDayFirst?: number | null;
    dueDaySecond?: number | null;
    cutoffDay?: number | null;
    isRecurring: boolean;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    isSubscription: boolean;
  },
  context?: FinanceContextType,
) {
  const body = {
    ...data,
    ...(data.suggestedAmount !== undefined || data.defaultAmount !== undefined
      ? { suggestedAmount: data.suggestedAmount ?? data.defaultAmount ?? null }
      : {}),
  };
  return clientFetchFromApi(`/api/expense-templates?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }, context);
}

export async function deleteExpenseTemplate(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/expense-templates?id=${id}`, {
    method: 'DELETE',
  }, context);
}

// Income template helpers
export async function createIncomeTemplate(
  data: {
    name: string;
    suggestedAmount?: number | null;
    source?: string | null;
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    active?: boolean;
    userId?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/income-templates', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function updateIncomeTemplate(
  id: number,
  data: {
    name?: string;
    suggestedAmount?: number | null;
    source?: string | null;
    appliesFirstFortnight?: boolean;
    appliesSecondFortnight?: boolean;
    active?: boolean;
    userId?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/income-templates?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, context);
}

export async function deleteIncomeTemplate(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/income-templates?id=${id}`, {
    method: 'DELETE',
  }, context);
}

export async function createIncome(
  data: {
    fortnight_id: number;
    amount: number;
    source?: string | null;
    received_at: string;
    transfer_from_user_id?: number;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/incomes', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function updateIncomeAmount(
  id: number,
  amount: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/incomes?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  }, context);
}

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

/**
 * Wallets
 */

/** Create Wallet **/
export async function createWallet(
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/wallets', {
    method: 'POST',
    body: JSON.stringify({ ...data }),
  }, context);
}

/** Update Wallet **/
export async function updateWallet(
  id: number,
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data }),
  }, context);
}

/** Update Wallet Status */
export async function updateWalletStatus(id: number, status: boolean) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: status }),
  })
}

/** Delete Wallet **/
export async function deleteWallet(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'DELETE',
  }, context);
}

// Budget helpers
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

// Expense paid status helpers
export async function updateExpensePaidStatus(
  id: number,
  paid: boolean,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/expenses/${id}/paid`, {
    method: 'PATCH',
    body: JSON.stringify({ paid }),
  }, context);
}

// Fortnight override amount helpers
export async function updateFortnightOverrideAmount(
  id: number,
  data: {
    amount: number;
    year: number;
    month: number;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/fortnights/${id}/override-amount`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, context);
}

// Transaction/Expense amount helpers
export async function updateExpenseAmount(
  id: number,
  amount: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify({ amount }),
  }, context);
}

// Delete expense transaction helper
export async function deleteTransaction(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/transactions?id=${id}`, {
    method: 'DELETE',
  }, context);
}

// Create expense transaction helper
export async function createExpenseTransaction(
  data: {
    fortnight_id: number;
    category_id: number;
    description: string;
    amount: number;
    payment_method_id: number;
    is_paid?: boolean;
    payment_date?: string | null;
    expense_template_id?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function createCreditCard(
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/credit-cards', {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function updateCreditCard(
  id: number,
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  const { amount, ...metadata } = data;
  void amount;
  return clientFetchFromApi(`/api/credit-cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(metadata),
  }, context);
}

export async function getCreditCardStatement(
  id: number,
  context?: FinanceContextType,
  asOf?: string,
) {
  const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : '';
  return clientFetchFromApi<CreditCardStatementResponse>(
    `/api/credit-cards/${id}/statement${query}`,
    undefined,
    context,
  );
}

export async function listCreditCardStatementImports(
  creditCardId: number,
  context?: FinanceContextType,
): Promise<CreditCardStatementImportListItem[]> {
  return clientFetchFromApi<CreditCardStatementImportListItem[]>(
    `/api/credit-cards/${creditCardId}/statement-imports`,
    undefined,
    context,
  );
}

export async function uploadCreditCardStatement(
  creditCardId: number,
  formData: FormData,
  context?: FinanceContextType,
): Promise<MercadoPagoStatementImportResponse> {
  return clientFetchMultipartJson<MercadoPagoStatementImportResponse>(
    `/api/credit-cards/${creditCardId}/statement-imports`,
    formData,
    context,
  );
}

/** @deprecated Use uploadCreditCardStatement */
export const uploadMercadoPagoCreditCardStatement = uploadCreditCardStatement;

export async function rollbackCreditCardStatementImport(
  creditCardId: number,
  importId: number,
  context?: FinanceContextType,
): Promise<{ expenses_removed: number }> {
  return clientFetchFromApi<{ expenses_removed: number }>(
    `/api/credit-cards/${creditCardId}/statement-imports/${importId}`,
    { method: 'DELETE' },
    context,
  );
}

export async function downloadCreditCardStatementImportFile(
  creditCardId: number,
  importId: number,
  context?: FinanceContextType,
): Promise<void> {
  let url = `/api/credit-cards/${creditCardId}/statement-imports/${importId}/file`;
  const ownerParams = buildOwnerQuery(context);
  if (ownerParams.toString()) {
    url = `${url}?${ownerParams.toString()}`;
  }

  const baseUrl = getClientApiBaseUrl();
  const res = await fetch(`${baseUrl}${url}`, { credentials: 'include' });

  if (!res.ok) {
    let message = 'No se pudo descargar el PDF';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const dispo = res.headers.get('Content-Disposition');
  let name = 'estado-cuenta.pdf';
  const m = dispo?.match(/filename="([^"]+)"/);
  if (m?.[1]) {
    name = m[1];
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function getCreditCardPayments(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardPaymentListItem[]>(
    `/api/credit-cards/${id}/payments`,
    undefined,
    context,
  );
}

export async function createCreditCardPayment(
  id: number,
  data: {
    source_wallet_id: number;
    amount: number;
    paid_at: string;
    note?: string | null;
    create_fortnight_expense?: boolean;
    category_id?: number;
    expense_description?: string | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/credit-cards/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function createCreditCardPurchase(
  creditCardId: number,
  data: {
    fortnight_id: number;
    category_id: number;
    description: string;
    amount: number;
    payment_date?: string | null;
    expense_template_id?: number | null;
    credit_msi_current?: number | null;
    credit_msi_total?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/credit-cards/${creditCardId}/purchase`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}
