'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type {
  CreditCardPaymentListItem,
  CreditCardPaymentPlanResponse,
  CreditCardStatementImportListItem,
  CreditCardStatementResponse,
  CreditCardScheduledPaymentItem,
  CreditCardScheduledPaymentsResponse,
  CreditCardInstallmentPlanItem,
  CreditCardInstallmentPlansResponse,
  CreditCardStatementImportPreviewResponse,
  MercadoPagoStatementImportResponse,
  InstallmentProjectionMonthItem,
} from '@/types/catalog';
import { WalletFormValues } from '@/schemas/wallet.schema';
import {
  buildOwnerQuery,
  getClientApiBaseUrl,
  clientFetchFromApi,
  clientFetchMultipartJson,
} from '@/lib/api/client-fetch';

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

export async function deleteCreditCard(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/credit-cards/${id}`, {
    method: 'DELETE',
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

export async function getCreditCardPaymentPlan(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardPaymentPlanResponse>(
    `/api/credit-cards/${id}/payment-plan`,
    undefined,
    context,
  );
}

export async function getCreditCardInstallmentProjection(
  context?: FinanceContextType,
) {
  return clientFetchFromApi<InstallmentProjectionMonthItem[]>(
    '/api/credit-cards/installment-projection',
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

export async function previewCreditCardStatement(
  creditCardId: number,
  formData: FormData,
  context?: FinanceContextType,
): Promise<CreditCardStatementImportPreviewResponse> {
  return clientFetchMultipartJson<CreditCardStatementImportPreviewResponse>(
    `/api/credit-cards/${creditCardId}/statement-imports/preview`,
    formData,
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
  data:
    | {
        mode?: 'wallet';
        source_wallet_id: number;
        amount: number;
        paid_at: string;
        note?: string | null;
        create_fortnight_expense?: boolean;
        category_id?: number;
        expense_description?: string | null;
        fortnight_id?: number;
      }
    | {
        mode: 'external';
        amount: number;
        paid_at: string;
        note?: string | null;
        adjusts_debt?: boolean;
      },
  context?: FinanceContextType,
) {
  const payload =
    data.mode === 'external'
      ? data
      : { mode: 'wallet' as const, ...data };
  return clientFetchFromApi(`/api/credit-cards/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, context);
}

export async function reverseCreditCardPayment(
  creditCardId: number,
  paymentId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<{ id: number; amount: number; expense_id: number | null }>(
    `/api/credit-cards/${creditCardId}/payments/${paymentId}`,
    { method: 'DELETE' },
    context,
  );
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
    credit_installment_current?: number | null;
    credit_installment_total?: number | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/credit-cards/${creditCardId}/purchase`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, context);
}

export async function listCreditCardScheduledPayments(
  creditCardId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardScheduledPaymentsResponse>(
    `/api/credit-cards/${creditCardId}/scheduled-payments`,
    undefined,
    context,
  );
}

export async function createCreditCardScheduledPayment(
  creditCardId: number,
  data: {
    due_date: string;
    amount: number;
    label?: string | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardScheduledPaymentItem>(
    `/api/credit-cards/${creditCardId}/scheduled-payments`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function updateCreditCardScheduledPayment(
  creditCardId: number,
  paymentId: number,
  data: {
    due_date?: string;
    amount?: number;
    label?: string | null;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardScheduledPaymentItem>(
    `/api/credit-cards/${creditCardId}/scheduled-payments/${paymentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function deleteCreditCardScheduledPayment(
  creditCardId: number,
  paymentId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<{ ok: boolean }>(
    `/api/credit-cards/${creditCardId}/scheduled-payments/${paymentId}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listCreditCardInstallmentPlans(
  creditCardId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardInstallmentPlansResponse>(
    `/api/credit-cards/${creditCardId}/installment-plans`,
    undefined,
    context,
  );
}

export async function createCreditCardInstallmentPlan(
  creditCardId: number,
  data: {
    name: string;
    installment_amount: number;
    total_installments: number;
    paid_installments?: number;
    next_due_date?: string;
    already_in_card_balance?: boolean;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardInstallmentPlanItem>(
    `/api/credit-cards/${creditCardId}/installment-plans`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
}

export async function deleteCreditCardInstallmentPlan(
  creditCardId: number,
  planId: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi<{ success: boolean }>(
    `/api/credit-cards/${creditCardId}/installment-plans/${planId}`,
    { method: 'DELETE' },
    context,
  );
}

export async function updateCreditCardInstallmentPlan(
  creditCardId: number,
  planId: number,
  data: {
    name: string;
    installment_amount: number;
    total_installments: number;
    paid_installments?: number;
    next_due_date?: string;
    already_in_card_balance?: boolean;
  },
  context?: FinanceContextType,
) {
  return clientFetchFromApi<CreditCardInstallmentPlanItem>(
    `/api/credit-cards/${creditCardId}/installment-plans/${planId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    context,
  );
}
