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

const FLICK_VELOCITY = 0.6;
const SIDE_SHIFT = 0.58;
const FAR_SHIFT = 0.3;
const SIDE_TURN_DEG = 38;

/**
 * Transform for a card `offset` positions from the front. Continuous, so it
 * can follow a fractional rail position while dragging; integer offsets give
 * the resting layout (front flat, neighbors turned toward the center).
 */
export const coverFlowSlot = (
  offset: number,
  sideReach: number = WALLET_COVER_FLOW_SIDE_REACH,
): CoverFlowSlot => {
  const sign = offset < 0 ? -1 : 1;
  const distance = Math.abs(offset);
  const near = Math.min(distance, 1);
  const far = Math.max(0, distance - 1);
  const fade = Math.min(1, Math.max(0, sideReach + 1 - distance));
  return {
    shift: sign * (SIDE_SHIFT * near + FAR_SHIFT * far),
    rotateY: -sign * SIDE_TURN_DEG * near + 0,
    scale: Math.max(0.7, 1 - 0.14 * near - 0.06 * far),
    opacity: Math.max(0, (1 - 0.2 * near - 0.2 * far) * fade),
    zIndex: Math.round(100 - distance * 10),
  };
};

/**
 * Where a release lands. `velocity` is the rail's speed in cards per second
 * (position change, so dragging left is positive). Momentum projects the
 * landing card; a quick flick always moves at least one card.
 */
export const settleFlowIndex = (
  position: number,
  velocity: number,
  count: number,
): number => {
  const base = Math.round(position);
  let target = Math.round(position + velocity * 0.18);
  if (target === base && Math.abs(velocity) > FLICK_VELOCITY) {
    target = base + Math.sign(velocity);
  }
  return clampFlowIndex(target, count);
};

/** Pull past either end of the rail is damped so it feels elastic. */
export const rubberBandPosition = (position: number, count: number): number => {
  const max = Math.max(0, count - 1);
  if (position < 0) return position * 0.35;
  if (position > max) return max + (position - max) * 0.35;
  return position;
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

export type WalletTypeSegment = 'all' | 'CASH' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'DEPARTMENT_STORE_CARD';

export const WALLET_TYPE_SEGMENTS: { value: WalletTypeSegment; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'DEBIT_CARD', label: 'Débito' },
  { value: 'CREDIT_CARD', label: 'Crédito' },
  { value: 'DEPARTMENT_STORE_CARD', label: 'Tiendas' },
];

/** Wallets in a type segment; `all` keeps everything. */
export const filterWalletsBySegment = (
  wallets: WalletListItem[],
  segment: WalletTypeSegment,
): WalletListItem[] =>
  segment === 'all' ? wallets : wallets.filter((w) => w.type === segment);

/** "Todas" plus each type that has at least one wallet, in a stable order. */
export const availableWalletSegments = (wallets: WalletListItem[]) =>
  WALLET_TYPE_SEGMENTS.filter(
    ({ value }) =>
      value === 'all' || wallets.some((wallet) => wallet.type === value),
  );
