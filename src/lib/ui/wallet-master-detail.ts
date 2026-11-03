import type { WalletListItem } from '@/types/catalog';
import { formatMoney } from '@/lib/money';

/** Query param that keeps the selected wallet in the URL (web master-detail). */
export const WALLET_SELECTION_PARAM = 'w';

/** Parse `?w=` into a wallet id; anything that is not a positive integer is null. */
export const parseWalletSelection = (raw: string | null | undefined): number | null => {
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id > 0 ? id : null;
};

/**
 * The wallet shown in the detail pane. Keeps the requested one while it is
 * still in the (filtered) list, otherwise falls back to the first wallet.
 * `ordered` must be the list in on-screen order.
 */
export const resolveSelectedWalletId = (
  ordered: readonly Pick<WalletListItem, 'id'>[],
  requestedId: number | null,
): number | null => {
  if (ordered.length === 0) return null;
  if (requestedId != null && ordered.some((w) => w.id === requestedId)) {
    return requestedId;
  }
  return ordered[0].id;
};

/** Neighbor id for arrow-key navigation; clamps at both ends. */
export const stepWalletSelection = (
  ordered: readonly Pick<WalletListItem, 'id'>[],
  currentId: number | null,
  delta: 1 | -1,
): number | null => {
  if (ordered.length === 0) return null;
  const index = ordered.findIndex((w) => w.id === currentId);
  const next = Math.min(
    Math.max((index < 0 ? 0 : index) + delta, 0),
    ordered.length - 1,
  );
  return ordered[next].id;
};

/** Splits a formatted amount so the cents can be muted: `$7,115` + `.23`. */
export const splitMoneyCents = (
  amount: number | string,
): { whole: string; cents: string } => {
  const text = formatMoney(amount);
  const dot = text.lastIndexOf('.');
  if (dot < 0) return { whole: text, cents: '' };
  return { whole: text.slice(0, dot), cents: text.slice(dot) };
};
