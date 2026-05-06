import { describe, expect, it } from 'vitest';
import { getWalletAvailableCredit } from '@/lib/finance/wallet-accounting';

describe('getWalletAvailableCredit', () => {
  it('returns null when there is no credit limit', () => {
    expect(getWalletAvailableCredit({ amount: 100, credit_limit: null })).toBeNull();
    expect(getWalletAvailableCredit({ amount: 100, credit_limit: undefined })).toBeNull();
  });

  it('returns limit minus balance (debt)', () => {
    expect(getWalletAvailableCredit({ amount: 200, credit_limit: 1000 })).toBe(800);
  });

  it('uses the greater of contractual limit and temporary limit', () => {
    expect(
      getWalletAvailableCredit({
        amount: 500,
        credit_limit: 1500,
        temporary_credit_limit: 2700,
      }),
    ).toBe(2200);
  });

  it('ignores temporary limit when it is not above base semantics', () => {
    expect(
      getWalletAvailableCredit({
        amount: 100,
        credit_limit: 2000,
        temporary_credit_limit: 1500,
      }),
    ).toBe(1900);
  });
});
