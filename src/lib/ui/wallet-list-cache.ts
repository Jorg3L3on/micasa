import type { FinanceContextType } from '@/types/finance-context';
import type { WalletListItem } from '@/types/catalog';

/**
 * In-memory wallet list cache so detail → list `nav-back` can paint
 * named `wallet-card-{id}` cards on the first frame (shared morph pair).
 */
const cache = new Map<string, WalletListItem[]>();

export function walletListOwnerKey(
  context: FinanceContextType | null | undefined,
): string | null {
  if (!context || context.id === 0) return null;
  return `${context.type}:${context.id}`;
}

export function setWalletListCache(
  ownerKey: string,
  wallets: WalletListItem[],
): void {
  cache.set(ownerKey, wallets);
}

export function getWalletListCache(
  ownerKey: string,
): WalletListItem[] | null {
  const hit = cache.get(ownerKey);
  if (!hit || hit.length === 0) return null;
  return hit;
}

export function clearWalletListCache(ownerKey?: string): void {
  if (ownerKey) {
    cache.delete(ownerKey);
    return;
  }
  cache.clear();
}
