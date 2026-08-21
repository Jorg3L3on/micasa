import {
  addTransitionType,
  startTransition,
  type CSSProperties,
} from 'react';

/**
 * Shared element name for wallet / credit-card list → detail morphs.
 * Must match on list card face, detail hero, and loading placeholder.
 */
export function walletCardViewTransitionName(walletId: number): string {
  return `wallet-card-${walletId}`;
}

export type WalletCardVtSnapshot = {
  id: number;
  name: string;
  typeLabel: string;
  amount: number;
  isCredit: boolean;
  providerIconKey: string | null;
  /** Serializable subset of the list-card face styles (gradients, etc.). */
  style: Record<string, string>;
};

const stashKey = (walletId: number) => `micasa.wallet-vt.${walletId}`;

/** Stable refs for useSyncExternalStore — never return a fresh parse each call. */
const snapshotCache = new Map<number, WalletCardVtSnapshot | null>();

function styleToRecord(
  style: CSSProperties | undefined,
): Record<string, string> {
  if (!style) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null || value === false) continue;
    out[key] = String(value);
  }
  return out;
}

export function stashWalletCardVtSnapshot(
  snapshot: Omit<WalletCardVtSnapshot, 'style'> & {
    style?: CSSProperties;
  },
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: WalletCardVtSnapshot = {
      id: snapshot.id,
      name: snapshot.name,
      typeLabel: snapshot.typeLabel,
      amount: snapshot.amount,
      isCredit: snapshot.isCredit,
      providerIconKey: snapshot.providerIconKey,
      style: styleToRecord(snapshot.style),
    };
    sessionStorage.setItem(stashKey(snapshot.id), JSON.stringify(payload));
    snapshotCache.set(snapshot.id, payload);
  } catch {
    /* private mode / quota */
  }
}

export function readWalletCardVtSnapshot(
  walletId: number,
): WalletCardVtSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(stashKey(walletId));
    if (!raw) return null;
    return JSON.parse(raw) as WalletCardVtSnapshot;
  } catch {
    return null;
  }
}

/**
 * Cached sessionStorage read for React subscriptions. Same reference until
 * stash/clear updates the cache — required by useSyncExternalStore.
 */
export function getCachedWalletCardVtSnapshot(
  walletId: number,
): WalletCardVtSnapshot | null {
  if (typeof window === 'undefined') return null;
  if (snapshotCache.has(walletId)) {
    return snapshotCache.get(walletId) ?? null;
  }
  const value = readWalletCardVtSnapshot(walletId);
  snapshotCache.set(walletId, value);
  return value;
}

export function clearWalletCardVtSnapshot(walletId: number): void {
  snapshotCache.delete(walletId);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(stashKey(walletId));
  } catch {
    /* ignore */
  }
}

export type NavTransitionType = 'nav-forward' | 'nav-back';

/**
 * Hierarchical navigation with a transition type (Next 16.1-safe).
 * Prefer this over `router.back()` so `nav-back` slides still run.
 */
export function navigateWithTransitionType(
  href: string,
  type: NavTransitionType,
  push: (href: string) => void,
): void {
  startTransition(() => {
    addTransitionType(type);
    push(href);
  });
}
