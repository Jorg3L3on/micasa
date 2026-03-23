import type { Prisma } from '@/generated/prisma/client';
import { PaymentMethodType } from '@/generated/prisma/client';

type WalletTypeLike = {
  type: PaymentMethodType;
};

export const CREDIT_WALLET_TYPES = new Set<PaymentMethodType>([
  PaymentMethodType.CREDIT_CARD,
  PaymentMethodType.DEPARTMENT_STORE_CARD,
]);

export const FUNDING_WALLET_TYPES = new Set<PaymentMethodType>([
  PaymentMethodType.CASH,
  PaymentMethodType.DEBIT_CARD,
]);

export const isCreditWalletType = (type: PaymentMethodType) =>
  CREDIT_WALLET_TYPES.has(type);

export const isFundingWalletType = (type: PaymentMethodType) =>
  FUNDING_WALLET_TYPES.has(type);

export const getPaidExpenseWalletDelta = (
  walletType: PaymentMethodType,
  amount: number,
) => {
  if (isCreditWalletType(walletType)) {
    return Math.abs(amount);
  }

  return -Math.abs(amount);
};

type PaidChargeWalletShape = {
  type: PaymentMethodType;
  amount: unknown;
  credit_limit: unknown;
};

export const assertPaidChargeAllowedForWallet = (
  wallet: PaidChargeWalletShape,
  chargeAmount: number,
) => {
  const balance = Number(wallet.amount);
  if (isCreditWalletType(wallet.type)) {
    const limit =
      wallet.credit_limit == null ? null : Number(wallet.credit_limit);
    if (limit != null && balance + chargeAmount > limit) {
      const error = new Error(
        'El gasto supera el crédito disponible',
      ) as Error & { code?: string };
      error.code = 'CREDIT_LIMIT_EXCEEDED';
      throw error;
    }
    return;
  }
  if (isFundingWalletType(wallet.type) && balance < chargeAmount) {
    const error = new Error(
      'Saldo insuficiente en la billetera',
    ) as Error & { code?: string };
    error.code = 'INSUFFICIENT_WALLET_BALANCE';
    throw error;
  }
};

export const getWalletAvailableCredit = ({
  amount,
  credit_limit,
}: {
  amount: number | null | undefined;
  credit_limit: number | null | undefined;
}) => {
  if (credit_limit == null) {
    return null;
  }

  return credit_limit - (amount ?? 0);
};

export const applyWalletAmountDelta = async (
  tx: Prisma.TransactionClient,
  walletId: number,
  delta: number,
) => {
  if (delta === 0) {
    return;
  }

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      amount:
        delta > 0
          ? { increment: delta }
          : { decrement: Math.abs(delta) },
    },
  });
};

export const toWalletAmountNumber = (wallet: {
  amount: Prisma.Decimal | number | string;
}) => Number(wallet.amount);

export const ensureCreditWalletType = (wallet: WalletTypeLike) => {
  if (isCreditWalletType(wallet.type)) {
    return;
  }

  const error = new Error('Wallet is not a credit card');
  (error as { code?: string }).code = 'INVALID_CREDIT_CARD';
  throw error;
};

export const ensureFundingWalletType = (wallet: WalletTypeLike) => {
  if (isFundingWalletType(wallet.type)) {
    return;
  }

  const error = new Error('Wallet cannot be used as a payment source');
  (error as { code?: string }).code = 'INVALID_PAYMENT_SOURCE_WALLET';
  throw error;
};
