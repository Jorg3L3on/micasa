import { describe, expect, it, vi } from 'vitest';
import { runPullRefresh } from '@/components/motion/mobile-pull-to-refresh';

describe('runPullRefresh', () => {
  it('resolves true and skips the error callback when the refresh succeeds', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();

    await expect(runPullRefresh(refresh, onError)).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports the failure and resolves false instead of throwing', async () => {
    const failure = new Error('offline');
    const refresh = vi.fn().mockRejectedValue(failure);
    const onError = vi.fn();

    await expect(runPullRefresh(refresh, onError)).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
