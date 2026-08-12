import { describe, expect, it } from 'vitest';
import { PaymentMethodType } from '@/generated/prisma/client';
import {
  countsTowardLiquidity,
  getWalletAvailableCredit,
} from '@/lib/finance/wallet-accounting';

describe('countsTowardLiquidity', () => {
  it('includes funding wallets by default', () => {
    expect(
      countsTowardLiquidity({ type: PaymentMethodType.CASH }),
    ).toBe(true);
    expect(
      countsTowardLiquidity({
        type: PaymentMethodType.DEBIT_CARD,
        include_in_liquidity: true,
      }),
    ).toBe(true);
  });

  it('excludes funding wallets when include_in_liquidity is false', () => {
    expect(
      countsTowardLiquidity({
        type: PaymentMethodType.CASH,
        include_in_liquidity: false,
      }),
    ).toBe(false);
  });

  it('never counts credit wallets toward liquidity', () => {
    expect(
      countsTowardLiquidity({
        type: PaymentMethodType.CREDIT_CARD,
        include_in_liquidity: true,
      }),
    ).toBe(false);
  });

  it('never counts GOAL wallets toward liquidity', () => {
    expect(
      countsTowardLiquidity({
        type: PaymentMethodType.GOAL,
        include_in_liquidity: true,
      }),
    ).toBe(false);
  });
});

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
