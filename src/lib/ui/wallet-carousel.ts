import { isGoalWalletType } from '@/domain/payment-method';

/** Wallet types the Panel financiero carousel can show, in tab order. */
export const WALLET_CAROUSEL_TYPES = [
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'DEPARTMENT_STORE_CARD',
] as const;

export type WalletCarouselType = (typeof WALLET_CAROUSEL_TYPES)[number];

export const WALLET_CAROUSEL_TAB_LABELS: Record<WalletCarouselType, string> = {
  DEBIT_CARD: 'Débito',
  CREDIT_CARD: 'Crédito',
  DEPARTMENT_STORE_CARD: 'Tienda',
  CASH: 'Efectivo',
};

export type WalletCarouselQuickAction =
  | 'balance'
  | 'expense'
  | 'income'
  | 'purchase'
  | 'payment';

export type WalletCarouselActionPlan = {
  /** Opens the balance dialog; credit wallets adjust "saldo utilizado". */
  topUp: 'balance';
  /** Cash/debit: expense tab of the transaction dialog. Credit/store: card purchase. */
  addExpense: 'expense' | 'purchase';
  /** Cash/debit: income tab of the transaction dialog. Credit/store: card payment. */
  request: 'income' | 'payment';
  requestLabel: string;
  balanceVariant: 'funding' | 'credit';
};

export const isWalletCarouselType = (
  type: string | null | undefined,
): type is WalletCarouselType =>
  WALLET_CAROUSEL_TYPES.includes(type as WalletCarouselType);

export const isCreditCarouselType = (
  type: string | null | undefined,
): boolean => type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD';

/** Which dialog each quick action opens for a wallet type. */
export const getWalletCarouselActionPlan = (
  type: string | null | undefined,
): WalletCarouselActionPlan =>
  isCreditCarouselType(type)
    ? {
        topUp: 'balance',
        addExpense: 'purchase',
        request: 'payment',
        requestLabel: 'Pagar',
        balanceVariant: 'credit',
      }
    : {
        topUp: 'balance',
        addExpense: 'expense',
        request: 'income',
        requestLabel: 'Ingreso',
        balanceVariant: 'funding',
      };

type WithType = { type: string };

/** Group wallets by carousel type; goal wallets (and unknown types) are left out. */
export const groupWalletsByCarouselType = <T extends WithType>(
  wallets: readonly T[],
): Record<WalletCarouselType, T[]> => {
  const groups: Record<WalletCarouselType, T[]> = {
    DEBIT_CARD: [],
    CREDIT_CARD: [],
    DEPARTMENT_STORE_CARD: [],
    CASH: [],
  };
  for (const wallet of wallets) {
    if (isGoalWalletType(wallet.type)) continue;
    if (isWalletCarouselType(wallet.type)) groups[wallet.type].push(wallet);
  }
  return groups;
};

/** First tab with wallets (in tab order); falls back to the first tab. */
export const firstCarouselTypeWithWallets = (
  groups: Record<WalletCarouselType, readonly unknown[]>,
): WalletCarouselType =>
  WALLET_CAROUSEL_TYPES.find((type) => groups[type].length > 0) ??
  WALLET_CAROUSEL_TYPES[0];

export const walletCarouselTabStorageKey = (ownerKey: string): string =>
  `micasa:wallet-carousel-tab:${ownerKey}`;

export const parseWalletCarouselTab = (
  raw: string | null | undefined,
): WalletCarouselType | null => (isWalletCarouselType(raw) ? raw : null);

export const clampCarouselIndex = (index: number, count: number): number =>
  count <= 0 ? 0 : Math.min(Math.max(index, 0), count - 1);

/** Swipe resolution: a long drag or a fast flick moves one card. */
export const resolveCarouselSwipe = ({
  offsetX,
  velocityX,
  threshold = 60,
  velocityThreshold = 400,
}: {
  offsetX: number;
  velocityX: number;
  threshold?: number;
  velocityThreshold?: number;
}): -1 | 0 | 1 => {
  if (offsetX <= -threshold || velocityX <= -velocityThreshold) return 1;
  if (offsetX >= threshold || velocityX >= velocityThreshold) return -1;
  return 0;
};

/** Used and available credit for a credit/store wallet (limit = max(contract, temporary)). */
export const getWalletCreditSummary = (wallet: {
  amount: number;
  credit_limit?: number | null;
  temporary_credit_limit?: number | null;
}): { used: number; limit: number | null; available: number | null } => {
  const base = wallet.credit_limit ?? null;
  const temp = wallet.temporary_credit_limit ?? null;
  const limit =
    base == null && temp == null ? null : Math.max(base ?? 0, temp ?? 0);
  const used = wallet.amount;
  return {
    used,
    limit,
    available: limit == null ? null : Math.max(limit - used, 0),
  };
};
