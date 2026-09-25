import { describe, expect, it } from 'vitest';
import { paidExpenseExceedsWalletBalance } from '@/lib/finance/expense-wallet-balance';

describe('paidExpenseExceedsWalletBalance', () => {
  it('is true when a paid cash expense is above the balance', () => {
    expect(
      paidExpenseExceedsWalletBalance({
        walletType: 'DEBIT_CARD',
        balance: 100,
        amount: 150,
        isPaid: true,
      }),
    ).toBe(true);
  });

  it('is false when the balance covers the expense', () => {
    expect(
      paidExpenseExceedsWalletBalance({
        walletType: 'CASH',
        balance: 200,
        amount: 200,
        isPaid: true,
      }),
    ).toBe(false);
  });

  it('is false when the expense is not paid or the wallet is credit', () => {
    expect(
      paidExpenseExceedsWalletBalance({
        walletType: 'DEBIT_CARD',
        balance: 0,
        amount: 50,
        isPaid: false,
      }),
    ).toBe(false);
    expect(
      paidExpenseExceedsWalletBalance({
        walletType: 'CREDIT_CARD',
        balance: 0,
        amount: 50,
        isPaid: true,
      }),
    ).toBe(false);
  });
});
