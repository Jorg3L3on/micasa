import type { BatchResponse } from '@/types/transaction-batch';

/**
 * Short-lived replay cache so a retried batch request (network drop after the
 * server saved) returns the original result instead of creating duplicates.
 * Process-local on purpose (no migration): on serverless a retry can land on
 * another instance, so the client also drops rows it already saw as `created`.
 */
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, { at: number; response: BatchResponse }>();

const keyFor = (ownerKey: string, idempotencyKey: string) =>
  `${ownerKey}:${idempotencyKey}`;

const prune = (now: number) => {
  for (const [key, entry] of cache) {
    if (now - entry.at > TTL_MS) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

export function getBatchReplay(
  ownerKey: string,
  idempotencyKey: string,
  now = Date.now(),
): BatchResponse | null {
  const entry = cache.get(keyFor(ownerKey, idempotencyKey));
  if (!entry || now - entry.at > TTL_MS) return null;
  return entry.response;
}

export function rememberBatch(
  ownerKey: string,
  idempotencyKey: string,
  response: BatchResponse,
  now = Date.now(),
) {
  prune(now);
  cache.set(keyFor(ownerKey, idempotencyKey), { at: now, response });
}

export function clearBatchReplayCache() {
  cache.clear();
}
