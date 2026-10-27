import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import type { WalletListItem } from '@/types/catalog';

/** Days ahead that put a card payment in the "Requiere atención" block. */
export const WALLET_ATTENTION_DUE_DAYS = 7;

/** Cards visible on each side of the centered face. */
export const WALLET_COVER_FLOW_SIDE_REACH = 2;

export const clampFlowIndex = (index: number, count: number): number => {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
};

export type CoverFlowSlot = {
  /** Horizontal shift as a fraction of one card width. */
  shift: number;
  rotateY: number;
  scale: number;
  opacity: number;
  zIndex: number;
};

/** Transform for a card `offset` positions away from the centered one. */
export const coverFlowSlot = (
  offset: number,
  sideReach: number = WALLET_COVER_FLOW_SIDE_REACH,
): CoverFlowSlot => {
  const distance = Math.abs(offset);
  if (distance === 0) {
    return { shift: 0, rotateY: 0, scale: 1, opacity: 1, zIndex: 100 };
  }
  const sign = offset < 0 ? -1 : 1;
  return {
    shift: sign * (0.58 + (distance - 1) * 0.3),
    rotateY: -sign * 38,
    scale: Math.max(0.7, 0.86 - (distance - 1) * 0.06),
    opacity: distance > sideReach ? 0 : Math.max(0.45, 0.8 - (distance - 1) * 0.2),
    zIndex: 100 - distance,
  };
};

export type WalletSections = {
  funding: WalletListItem[];
  credit: WalletListItem[];
};

export const groupWalletsBySection = (
  wallets: WalletListItem[],
): WalletSections => ({
  funding: wallets.filter((w) => !isCreditOrStoreCardWalletType(w.type)),
  credit: wallets.filter((w) => isCreditOrStoreCardWalletType(w.type)),
});

export const effectiveCreditLimit = (wallet: WalletListItem): number | null => {
  const { credit_limit: base, temporary_credit_limit: temp } = wallet;
  if (base == null && temp == null) return null;
  return Math.max(base ?? 0, temp ?? 0);
};

export type WalletTotals = {
  liquidity: number;
  cardDebt: number;
  availableCredit: number;
};

/** Totals over active wallets; liquidity only counts wallets flagged for it. */
export const summarizeWallets = (wallets: WalletListItem[]): WalletTotals => {
  const totals: WalletTotals = { liquidity: 0, cardDebt: 0, availableCredit: 0 };
  for (const wallet of wallets) {
    if (!wallet.active) continue;
    const amount = Number(wallet.amount) || 0;
    if (isCreditOrStoreCardWalletType(wallet.type)) {
      totals.cardDebt += Math.max(0, amount);
      const limit = effectiveCreditLimit(wallet);
      if (limit != null && limit > 0) {
        totals.availableCredit += Math.max(0, limit - amount);
      }
    } else if (wallet.include_in_liquidity) {
      totals.liquidity += amount;
    }
  }
  return totals;
};

/** Days until the next `dueDay`, given today's day of month and month length. */
export const daysUntilDueDay = (
  dueDay: number,
  today: { day: number; daysInMonth: number },
): number => {
  const due = Math.min(dueDay, today.daysInMonth);
  return due >= today.day
    ? due - today.day
    : today.daysInMonth - today.day + dueDay;
};

export type WalletAttentionReason =
  | 'due-soon'
  | 'missing-due-day'
  | 'negative-balance'
  | 'over-limit';

export type WalletAttentionItem = {
  wallet: WalletListItem;
  reason: WalletAttentionReason;
  daysUntilDue: number | null;
};

export const buildAttentionItems = (
  wallets: WalletListItem[],
  today: { day: number; daysInMonth: number },
): WalletAttentionItem[] => {
  const items: WalletAttentionItem[] = [];
  for (const wallet of wallets) {
    if (!wallet.active) continue;
    const amount = Number(wallet.amount) || 0;
    if (isCreditOrStoreCardWalletType(wallet.type)) {
      const limit = effectiveCreditLimit(wallet);
      if (limit != null && limit > 0 && amount > limit) {
        items.push({ wallet, reason: 'over-limit', daysUntilDue: null });
      } else if (wallet.due_day == null) {
        if (amount > 0) {
          items.push({ wallet, reason: 'missing-due-day', daysUntilDue: null });
        }
      } else if (amount > 0) {
        const days = daysUntilDueDay(wallet.due_day, today);
        if (days <= WALLET_ATTENTION_DUE_DAYS) {
          items.push({ wallet, reason: 'due-soon', daysUntilDue: days });
        }
      }
    } else if (amount < 0) {
      items.push({ wallet, reason: 'negative-balance', daysUntilDue: null });
    }
  }
  return items.sort(
    (a, b) => (a.daysUntilDue ?? -1) - (b.daysUntilDue ?? -1),
  );
};
