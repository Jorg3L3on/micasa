import { describe, expect, it } from 'vitest';

import {
  formatAxisMoney,
  formatMoney,
  MONEY_SIZE_CLASS,
  MONEY_TONE_CLASS,
  resolveMoneyTone,
} from '@/lib/money';

describe('formatMoney', () => {
  it('uses one Intl sign and no space around the decimal', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(12.5)).toBe('$12.50');
    expect(formatMoney(-12.5)).toBe('-$12.50');
    expect(formatMoney(-12.5)).not.toMatch(/−/);
    expect(formatMoney(0)).not.toMatch(/\s/);
  });
});

describe('resolveMoneyTone', () => {
  it('maps sign to the single tone table', () => {
    expect(resolveMoneyTone(-1)).toBe('negative');
    expect(resolveMoneyTone(1)).toBe('positive');
    expect(resolveMoneyTone(0)).toBe('neutral');
    expect(resolveMoneyTone(-20, 'neutral')).toBe('neutral');
    expect(MONEY_TONE_CLASS.negative).toBe('text-destructive');
    expect(MONEY_TONE_CLASS.positive).toContain('text-emerald-600');
  });
});

describe('MONEY_SIZE_CLASS', () => {
  it('uses sans tabular figures at hero, row, and caption weights', () => {
    for (const size of ['hero', 'row', 'caption'] as const) {
      expect(MONEY_SIZE_CLASS[size]).toContain('font-sans');
      expect(MONEY_SIZE_CLASS[size]).toContain('tabular-nums');
      expect(MONEY_SIZE_CLASS[size]).not.toContain('font-sans');
    }
    expect(MONEY_SIZE_CLASS.hero).toContain('font-bold');
    expect(MONEY_SIZE_CLASS.row).toContain('font-semibold');
    expect(MONEY_SIZE_CLASS.caption).toContain('font-medium');
    expect(MONEY_SIZE_CLASS.caption).toContain('text-caption');
  });
});

describe('formatAxisMoney', () => {
  it('prefixes $ and abbreviates thousands and millions the same way', () => {
    expect(formatAxisMoney(0)).toBe('$0');
    expect(formatAxisMoney(850)).toBe('$850');
    expect(formatAxisMoney(1500)).toBe('$1.5k');
    expect(formatAxisMoney(2000)).toBe('$2k');
    expect(formatAxisMoney(12000)).toBe('$12k');
    expect(formatAxisMoney(1_200_000)).toBe('$1.2M');
    expect(formatAxisMoney(12_000_000)).toBe('$12M');
    expect(formatAxisMoney(-1500)).toBe('-$1.5k');
    expect(formatAxisMoney(Number.NaN)).toBe('');
  });
});
