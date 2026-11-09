import { afterEach, describe, expect, it, vi } from 'vitest';

import { measure } from '@/features/monthly/server/monthly.performance';

describe('measure', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the result without logging unless MICASA_PERF_LOG=1', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(measure('monthly.step', async () => 42)).resolves.toBe(42);
    expect(log).not.toHaveBeenCalled();
  });

  it('logs the step timing with MICASA_PERF_LOG=1', async () => {
    vi.stubEnv('MICASA_PERF_LOG', '1');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(measure('monthly.step', async () => 'ok')).resolves.toBe('ok');
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[perf\] monthly\.step \d+\.\d{2}ms$/));
  });
});
