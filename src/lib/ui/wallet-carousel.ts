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

/**
 * One continuous track: every carousel wallet grouped in tab order, keeping the
 * order of `ordered` inside each type (pass the strip's saved order there).
 */
export const orderWalletsForCarousel = <T extends WithType>(
  ordered: readonly T[],
): T[] => {
  const groups = groupWalletsByCarouselType(ordered);
  return WALLET_CAROUSEL_TYPES.flatMap((type) => groups[type]);
};

/** Index of the first wallet of `type` in the track, or -1. */
export const firstCarouselIndexOfType = (
  track: readonly WithType[],
  type: WalletCarouselType,
): number => track.findIndex((wallet) => wallet.type === type);

/** Start (inclusive) and end (exclusive) of the active wallet's type run. */
export const carouselTypeRange = (
  track: readonly WithType[],
  index: number,
): { start: number; end: number } => {
  if (track.length === 0) return { start: 0, end: 0 };
  const i = clampCarouselIndex(index, track.length);
  const type = track[i].type;
  let start = i;
  while (start > 0 && track[start - 1].type === type) start -= 1;
  let end = i + 1;
  while (end < track.length && track[end].type === type) end += 1;
  return { start, end };
};

export const walletCarouselActiveStorageKey = (ownerKey: string): string =>
  `micasa:wallet-carousel-active:${ownerKey}`;

/** Stored active wallet id → its index in the track (0 when missing or gone). */
export const resolveStoredCarouselIndex = (
  track: readonly { id: number }[],
  raw: string | null | undefined,
): number => {
  const id = Number(raw);
  if (!raw || !Number.isInteger(id)) return 0;
  const found = track.findIndex((wallet) => wallet.id === id);
  return found >= 0 ? found : 0;
};

export const clampCarouselIndex = (index: number, count: number): number =>
  count <= 0 ? 0 : Math.min(Math.max(index, 0), count - 1);

/** Card nearest the viewport center for a centered, padded scroll track. */
export const carouselIndexFromScroll = (
  scrollLeft: number,
  step: number,
  count: number,
): number =>
  step > 0 ? clampCarouselIndex(Math.round(scrollLeft / step), count) : 0;

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
