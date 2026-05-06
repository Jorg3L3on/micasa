'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type { PaymentMethodOption, WalletListItem } from '@/types/catalog';
import { WalletFormValues } from '@/schemas/wallet.schema';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

const getEffectiveCreditLimit = ({
  credit_limit,
  temporary_credit_limit,
}: {
  credit_limit: number | null;
  temporary_credit_limit: number | null;
}): number | null => {
  if (credit_limit == null && temporary_credit_limit == null) return null;
  if (credit_limit == null) return temporary_credit_limit;
  if (temporary_credit_limit == null) return credit_limit;
  return Math.max(credit_limit, temporary_credit_limit);
};

const getWalletAvailableCredit = ({
  amount,
  credit_limit,
  temporary_credit_limit,
}: {
  amount: number;
  credit_limit: number | null;
  temporary_credit_limit: number | null;
}) => {
  const cap = getEffectiveCreditLimit({ credit_limit, temporary_credit_limit });
  if (cap == null) return null;
  return cap - amount;
};

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
      const amountNum = Number(w.amount);
      const limitNum =
        w.credit_limit != null ? Number(w.credit_limit) : null;
      const tempLimitNum =
        w.temporary_credit_limit != null
          ? Number(w.temporary_credit_limit)
          : null;
      const amount = Number.isFinite(amountNum) ? amountNum : 0;
      const credit_limit =
        limitNum != null && Number.isFinite(limitNum) ? limitNum : null;
      const temporary_credit_limit =
        tempLimitNum != null && Number.isFinite(tempLimitNum)
          ? tempLimitNum
          : null;
      return {
        id: w.id,
        name: w.name,
        provider_icon_key: w.provider_icon_key ?? null,
        type: w.type,
        amount,
        credit_limit,
        temporary_credit_limit,
        available_credit: getWalletAvailableCredit({
          amount,
          credit_limit,
          temporary_credit_limit,
        }),
      };
    });
}

export async function createWallet(
  data: WalletFormValues,
  context?: FinanceContextType,
) {
  return clientFetchFromApi('/api/wallets', {
    method: 'POST',
    body: JSON.stringify({ ...data }),
  }, context);
}

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

export async function updateWalletStatus(id: number, status: boolean) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: status }),
  });
}

export async function deleteWallet(
  id: number,
  context?: FinanceContextType,
) {
  return clientFetchFromApi(`/api/wallets?id=${id}`, {
    method: 'DELETE',
  }, context);
}
