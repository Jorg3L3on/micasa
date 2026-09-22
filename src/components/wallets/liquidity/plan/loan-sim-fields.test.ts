import { describe, expect, it } from 'vitest';
import { parseLoanSimFields } from '@/components/wallets/liquidity/plan/loan-sim-fields';

describe('parseLoanSimFields', () => {
  it('stays empty until rate, term, and fee are all valid', () => {
    expect(parseLoanSimFields('', '', '')).toBeNull();
    expect(parseLoanSimFields('24', '', '2')).toBeNull();
    expect(parseLoanSimFields('0', '12', '2')).toBeNull();
    expect(parseLoanSimFields('24', '12.5', '2')).toBeNull();
  });

  it('converts percent inputs into engine decimals', () => {
    expect(parseLoanSimFields('24', '12', '2')).toEqual({
      aprAnnual: 0.24,
      termMonths: 12,
      feePct: 0.02,
    });
    expect(parseLoanSimFields('18,5', '6', '0')).toEqual({
      aprAnnual: 0.185,
      termMonths: 6,
      feePct: 0,
    });
  });
});
