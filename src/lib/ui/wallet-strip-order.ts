/** localStorage key prefix — layout preference for Panel financiero wallet cards. */
export const WALLET_STRIP_ORDER_STORAGE_KEY =
  'micasa.planificacion.walletStripOrder';

export type WalletStripSortable = {
  id: number;
  name: string;
  type: string;
  amount: number;
  credit_limit?: number | null;
};

export const walletStripOrderStorageKey = (
  ownerType: string,
  ownerId: number,
): string => `${WALLET_STRIP_ORDER_STORAGE_KEY}:${ownerType}:${ownerId}`;

const typeRank = (type: string): number => {
  if (type === 'CASH') return 0;
  if (type === 'DEBIT_CARD') return 1;
  if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
  return 3;
};

const isCreditType = (type: string): boolean =>
  type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD';

const usedPct = (
  wallet: WalletStripSortable,
  amountOf: (wallet: WalletStripSortable) => number,
): number => {
  const limit = Number(wallet.credit_limit ?? 0);
  if (limit <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, Number(amountOf(wallet))) / limit;
};

/** Default strip order used until the user drags a custom sequence. */
export const defaultWalletStripOrder = <T extends WalletStripSortable>(
  wallets: T[],
  amountOf: (wallet: T) => number = (wallet) => wallet.amount,
): T[] =>
  [...wallets].sort((a, b) => {
    const rankDiff = typeRank(a.type) - typeRank(b.type);
    if (rankDiff !== 0) return rankDiff;

    if (isCreditType(a.type) && isCreditType(b.type)) {
      const usedPctDiff = usedPct(a, amountOf) - usedPct(b, amountOf);
      if (usedPctDiff !== 0) return usedPctDiff;
    }

    return a.name.localeCompare(b.name);
  });

/** Apply a saved id list; unknown ids are dropped and new wallets append. */
export const applyWalletStripOrder = <T extends { id: number }>(
  wallets: T[],
  savedIds: number[] | null | undefined,
): T[] => {
  if (!savedIds || savedIds.length === 0) return wallets;

  const byId = new Map(wallets.map((wallet) => [wallet.id, wallet]));
  const ordered: T[] = [];
  const seen = new Set<number>();

  for (const id of savedIds) {
    const wallet = byId.get(id);
    if (!wallet || seen.has(id)) continue;
    ordered.push(wallet);
    seen.add(id);
  }

  for (const wallet of wallets) {
    if (!seen.has(wallet.id)) ordered.push(wallet);
  }

  return ordered;
};

/** Move `id` to `toIndex` in the current list (toIndex is the slot in the pre-move array). */
export const moveWalletStripId = (
  ids: number[],
  id: number,
  toIndex: number,
): number[] => {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const clamped = Math.max(0, Math.min(ids.length, toIndex));
  if (from === clamped || (from === ids.length - 1 && clamped === ids.length)) {
    return ids;
  }
  const next = [...ids];
  next.splice(from, 1);
  const dest = clamped > from ? clamped - 1 : clamped;
  next.splice(dest, 0, id);
  return next;
};

export const parseWalletStripOrder = (raw: string | null): number[] | null => {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((id) => typeof id === 'number' && Number.isInteger(id))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const readWalletStripOrder = (
  ownerType: string,
  ownerId: number,
): number[] | null => {
  if (typeof window === 'undefined' || ownerId <= 0) return null;
  try {
    return parseWalletStripOrder(
      localStorage.getItem(walletStripOrderStorageKey(ownerType, ownerId)),
    );
  } catch {
    return null;
  }
};

export const writeWalletStripOrder = (
  ownerType: string,
  ownerId: number,
  ids: number[],
): void => {
  if (typeof window === 'undefined' || ownerId <= 0) return;
  try {
    localStorage.setItem(
      walletStripOrderStorageKey(ownerType, ownerId),
      JSON.stringify(ids),
    );
  } catch {
    /* ignore quota / private mode */
  }
};

export const WALLET_STRIP_AUTO_SCROLL_EDGE_PX = 72;
export const WALLET_STRIP_AUTO_SCROLL_MAX_STEP = 24;
export const WALLET_STRIP_AUTO_SCROLL_VERTICAL_SLACK_PX = 56;

/** Horizontal scroll delta while dragging near a strip edge. Negative = left. */
export const walletStripAutoScrollDelta = (
  pointerX: number,
  containerLeft: number,
  containerRight: number,
  edgePx: number = WALLET_STRIP_AUTO_SCROLL_EDGE_PX,
  maxStep: number = WALLET_STRIP_AUTO_SCROLL_MAX_STEP,
): number => {
  if (containerRight <= containerLeft || edgePx <= 0 || maxStep <= 0) return 0;

  const leftZoneEnd = containerLeft + edgePx;
  if (pointerX < leftZoneEnd) {
    const intensity = Math.min(1, (leftZoneEnd - pointerX) / edgePx);
    return -Math.max(2, Math.round(maxStep * intensity));
  }

  const rightZoneStart = containerRight - edgePx;
  if (pointerX > rightZoneStart) {
    const intensity = Math.min(1, (pointerX - rightZoneStart) / edgePx);
    return Math.max(2, Math.round(maxStep * intensity));
  }

  return 0;
};

export const isPointerNearWalletStrip = (
  pointerY: number,
  containerTop: number,
  containerBottom: number,
  slackPx: number = WALLET_STRIP_AUTO_SCROLL_VERTICAL_SLACK_PX,
): boolean =>
  pointerY >= containerTop - slackPx && pointerY <= containerBottom + slackPx;
