import { describe, expect, it } from 'vitest';
import {
  displayIncomingCash,
  formatMonthYearLabel,
  monthKeyFromParts,
  shiftSelectedMonthKey,
} from '@/components/wallets/liquidity/liquidity-personalization';

describe('liquidity month selection helpers', () => {
  const keys = ['2026-01', '2026-02', '2026-03'];

  it('pads month keys to YYYY-MM', () => {
    expect(monthKeyFromParts(2026, 1)).toBe('2026-01');
    expect(monthKeyFromParts(2026, 12)).toBe('2026-12');
  });

  it('moves to the next and previous month without wrapping', () => {
    expect(shiftSelectedMonthKey(keys, '2026-02', 1)).toBe('2026-03');
    expect(shiftSelectedMonthKey(keys, '2026-02', -1)).toBe('2026-01');
    expect(shiftSelectedMonthKey(keys, '2026-01', -1)).toBe('2026-01');
    expect(shiftSelectedMonthKey(keys, '2026-03', 1)).toBe('2026-03');
  });

  it('falls back to the first month when the current key is missing', () => {
    expect(shiftSelectedMonthKey(keys, '', 0)).toBe('2026-01');
    expect(shiftSelectedMonthKey(keys, '1999-01', 1)).toBe('2026-02');
    expect(shiftSelectedMonthKey([], '2026-01', 1)).toBe('2026-01');
  });

  it('title-cases the month without capitalizing de', () => {
    expect(formatMonthYearLabel('2026-11')).toBe('Noviembre de 2026');
  });

  it('never shows negative cash as Entra', () => {
    expect(displayIncomingCash(-8072.82)).toBe(0);
    expect(displayIncomingCash(0)).toBe(0);
    expect(displayIncomingCash(166400)).toBe(166400);
  });
});
