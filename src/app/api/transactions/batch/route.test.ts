import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOwnerContext, processTransactionBatch } = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  processTransactionBatch: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext }));
vi.mock('@/lib/finance/transaction-batch.service', () => ({
  processTransactionBatch,
}));

import { POST } from './route';
import { clearBatchReplayCache } from '@/lib/finance/batch-idempotency';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/transactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0],
  );

const okResponse = {
  results: [{ clientId: 'a', status: 'created', id: 1 }],
  summary: { total: 1, created: 1, failed: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  clearBatchReplayCache();
  getOwnerContext.mockResolvedValue(ownerContext);
  processTransactionBatch.mockResolvedValue(okResponse);
});

describe('POST /api/transactions/batch', () => {
  it('returns per-row results', async () => {
    const res = await post({ items: [{ clientId: 'a' }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(okResponse);
  });

  it('rejects an empty batch and one over the cap', async () => {
    expect((await post({ items: [] })).status).toBe(400);
    const tooMany = Array.from({ length: 26 }, (_, i) => ({ clientId: `r${i}` }));
    expect((await post({ items: tooMany })).status).toBe(400);
    expect(processTransactionBatch).not.toHaveBeenCalled();
  });

  it('replays the first result for a repeated Idempotency-Key', async () => {
    await post({ items: [{ clientId: 'a' }] }, { 'Idempotency-Key': 'k1' });
    const second = await post(
      { items: [{ clientId: 'a' }] },
      { 'Idempotency-Key': 'k1' },
    );
    expect(second.status).toBe(200);
    expect(processTransactionBatch).toHaveBeenCalledTimes(1);
  });
});
