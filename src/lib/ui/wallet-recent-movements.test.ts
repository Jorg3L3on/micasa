import { describe, expect, it, vi } from 'vitest';
import { recentMovementsKey } from './wallet-recent-movements';

describe('recentMovementsKey', () => {
  it('changes with the wallet balance so new movements refresh the list', () => {
    const user = { type: 'user' as const, id: 1 };
    expect(recentMovementsKey(user, 5, 100)).not.toBe(
      recentMovementsKey(user, 5, 80),
    );
  });

  it('separates owners and wallets', () => {
    expect(recentMovementsKey({ type: 'user', id: 1 }, 5, 100)).not.toBe(
      recentMovementsKey({ type: 'house', id: 1 }, 5, 100),
    );
    expect(recentMovementsKey({ type: 'user', id: 1 }, 5, 100)).not.toBe(
      recentMovementsKey({ type: 'user', id: 1 }, 6, 100),
    );
  });
});

describe('recent movements cache', () => {
  it('serves a fetched list until it expires', async () => {
    vi.resetModules();
    vi.doMock('@/lib/api/client-fetch', () => ({
      clientFetchFromApi: vi.fn().mockResolvedValue({
        movements: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      }),
    }));
    const mod = await import('./wallet-recent-movements');
    const context = { type: 'user' as const, id: 1 };
    const key = mod.recentMovementsKey(context, 5, 100);

    expect(mod.getCachedRecentMovements(key)).toBeNull();
    const list = await mod.fetchRecentMovements(key, 5, context);
    expect(list).toHaveLength(3);
    expect(mod.getCachedRecentMovements(key)).toHaveLength(3);
    expect(mod.getCachedRecentMovements(key, Date.now() + 61_000)).toBeNull();
    vi.doUnmock('@/lib/api/client-fetch');
  });
});
