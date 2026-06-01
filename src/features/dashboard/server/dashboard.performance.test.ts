import { describe, expect, it, vi } from 'vitest';
import { measure } from './dashboard.performance';

describe('measure', () => {
  it('returns the callback result', async () => {
    await expect(measure('test.label', async () => 42)).resolves.toBe(42);
  });

  it('rethrows errors from the callback', async () => {
    const error = new Error('boom');
    await expect(
      measure('test.label', async () => {
        throw error;
      }),
    ).rejects.toThrow(error);
  });

  it('logs perf timing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await measure('dashboard.sample', async () => 'ok');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[perf\] dashboard\.sample \d+\.\d{2}ms$/),
    );
    logSpy.mockRestore();
  });
});
