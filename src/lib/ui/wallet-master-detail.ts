import type { WalletListItem } from '@/types/catalog';

/** Query param that keeps the selected wallet in the URL (web card gallery). */
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

export type WalletGalleryTab = 'all' | 'funding' | 'credit';

/** Wallets shown under a gallery tab; `funding` and `credit` come pre-grouped. */
export const walletsForTab = <T,>(
  tab: WalletGalleryTab,
  sections: { funding: T[]; credit: T[] },
): T[] =>
  tab === 'funding'
    ? sections.funding
    : tab === 'credit'
      ? sections.credit
      : [...sections.funding, ...sections.credit];
