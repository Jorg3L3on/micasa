import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { FinanceContextType } from '@/types/finance-context';
import type {
  WalletMovement,
  WalletMovementsResponse,
} from '@/types/wallet-movements';

export const RECENT_MOVEMENTS_LIMIT = 3;
const CACHE_TTL_MS = 60_000;

type CacheEntry = { at: number; movements: WalletMovement[] };
const cache = new Map<string, CacheEntry>();

/**
 * Cache key: owner, wallet and its balance. A balance change (a new movement,
 * a transfer, a payment) makes a new key, so the list refreshes by itself.
 */
export const recentMovementsKey = (
  context: Pick<FinanceContextType, 'type' | 'id'>,
  walletId: number,
  balance: number,
): string => `${context.type}:${context.id}:${walletId}:${balance}`;

export const getCachedRecentMovements = (
  key: string,
  now: number = Date.now(),
): WalletMovement[] | null => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.movements;
};

export const fetchRecentMovements = async (
  key: string,
  walletId: number,
  context: FinanceContextType,
): Promise<WalletMovement[]> => {
  const response = await clientFetchFromApi<WalletMovementsResponse>(
    `/api/wallets/${walletId}/movements?latest=${RECENT_MOVEMENTS_LIMIT}`,
    undefined,
    context,
  );
  const movements = response.movements.slice(0, RECENT_MOVEMENTS_LIMIT);
  cache.set(key, { at: Date.now(), movements });
  return movements;
};
