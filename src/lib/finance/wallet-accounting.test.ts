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
});
