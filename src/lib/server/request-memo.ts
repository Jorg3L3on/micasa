/**
 * Per-request memo for read-only planner computations in route handlers.
 *
 * `React.cache` dedupes inside one RSC render but is a passthrough in route
 * handlers, so `/api/reports`, `/api/alerts` and `/api/transactions` used to
 * recompute the card-dues and loan planners and the budget panel on every
 * internal call. `withOwnerContext` opens a store for GET requests only, so a
 * write in the same request can never read a result computed before it.
 *
 * The store is a fresh Map per request and dies with it; keys carry the owner,
 * so no result is shared across requests or owners.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

type MemoStore = Map<string, Promise<unknown>>;

/** One store per process, like the audit actor store (modules load more than once). */
const STORAGE_KEY = Symbol.for('micasa.requestMemoStorage');
const globalStore = globalThis as unknown as Record<symbol, AsyncLocalStorage<MemoStore> | undefined>;
const storage = (globalStore[STORAGE_KEY] ??= new AsyncLocalStorage<MemoStore>());

export const runWithRequestMemo = <T>(fn: () => T): T => storage.run(new Map(), fn);

/** `compute()` once per key within the current request scope; outside a scope, always computes. */
export function requestMemo<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const memo = storage.getStore();
  if (!memo) return compute();
  const hit = memo.get(key);
  if (hit) return hit as Promise<T>;
  const pending = compute();
  memo.set(key, pending);
  // A failed computation is not reused: the next caller retries.
  pending.catch(() => {
    if (memo.get(key) === pending) memo.delete(key);
  });
  return pending;
}

/** Memo key for an owner-scoped month computation. */
export const ownerMonthKey = (
  name: string,
  userId: number | null,
  houseId: number | null,
  year: number,
  month: number,
): string => `${name}:${userId ?? '-'}:${houseId ?? '-'}:${year}-${month}`;
