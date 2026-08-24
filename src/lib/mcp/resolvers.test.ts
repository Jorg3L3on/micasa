import { describe, expect, it } from 'vitest';
import { resolveDateRange } from '@/lib/mcp/resolvers';

describe('resolveDateRange', () => {
  it('defaults to last 30 days when no filters', () => {
    const range = resolveDateRange({});
    expect(range.from <= range.to).toBe(true);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('honors explicit from/to', () => {
    expect(
      resolveDateRange({ from: '2026-01-01', to: '2026-01-31' }),
    ).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('supports last_n_days shortcut', () => {
    const range = resolveDateRange({ last_n_days: 7 });
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
