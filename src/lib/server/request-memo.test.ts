import { describe, expect, it, vi } from 'vitest';

import { ownerMonthKey, requestMemo, runWithRequestMemo } from '@/lib/server/request-memo';

describe('requestMemo', () => {
  it('computes once per key inside one request scope', async () => {
    const compute = vi.fn(async () => ({ total: 1 }));
    const [a, b] = await runWithRequestMemo(() =>
      Promise.all([requestMemo('k', compute), requestMemo('k', compute)]),
    );
    expect(compute).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('never shares a result between two requests, even for the same key', async () => {
    const compute = vi.fn(async () => ({}));
    const a = await runWithRequestMemo(() => requestMemo('k', compute));
    const b = await runWithRequestMemo(() => requestMemo('k', compute));
    expect(compute).toHaveBeenCalledTimes(2);
    expect(a).not.toBe(b);
  });

  it('keeps two owners apart inside concurrent requests', async () => {
    const run = (userId: number) =>
      runWithRequestMemo(async () => {
        await Promise.resolve();
        return requestMemo(ownerMonthKey('card-dues', userId, null, 2026, 11), async () => ({ userId }));
      });
    const [userA, userB] = await Promise.all([run(7), run(8)]);
    expect(userA).toEqual({ userId: 7 });
    expect(userB).toEqual({ userId: 8 });
  });

  it('separates owners within one request by key', async () => {
    const result = await runWithRequestMemo(async () => {
      const user = await requestMemo(ownerMonthKey('card-dues', 7, null, 2026, 11), async () => 'user 7');
      const house = await requestMemo(ownerMonthKey('card-dues', null, 7, 2026, 11), async () => 'house 7');
      return { user, house };
    });
    expect(result).toEqual({ user: 'user 7', house: 'house 7' });
  });

  it('computes every time outside a request scope', async () => {
    const compute = vi.fn(async () => 1);
    await requestMemo('k', compute);
    await requestMemo('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed computation', async () => {
    let calls = 0;
    const compute = async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return 'ok';
    };
    const second = await runWithRequestMemo(async () => {
      await expect(requestMemo('k', compute)).rejects.toThrow('boom');
      return requestMemo('k', compute);
    });
    expect(second).toBe('ok');
    expect(calls).toBe(2);
  });
});
