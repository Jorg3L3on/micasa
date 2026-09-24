import { describe, expect, it } from 'vitest';
import { PaymentMethodType } from '@/generated/prisma/client';
import {
  INCOME_WALLET_REQUIRED_MESSAGE,
  INCOME_WALLET_TYPE_MESSAGE,
  assertIncomeFundingWallet,
  resolveIncomeWalletId,
} from '@/lib/finance/income.service';

describe('resolveIncomeWalletId', () => {
  it('rejects an update that still has no wallet', () => {
    expect(() => resolveIncomeWalletId(null, undefined)).toThrow(
      INCOME_WALLET_REQUIRED_MESSAGE,
    );
  });

  it('keeps the existing wallet when the edit does not send one', () => {
    expect(resolveIncomeWalletId(8, undefined)).toBe(8);
  });

  it('uses the wallet sent with the amount', () => {
    expect(resolveIncomeWalletId(null, 4)).toBe(4);
    expect(resolveIncomeWalletId(8, 4)).toBe(4);
  });
});

describe('assertIncomeFundingWallet', () => {
  it('accepts cash and debit wallets', () => {
    expect(() =>
      assertIncomeFundingWallet({ type: PaymentMethodType.CASH }),
    ).not.toThrow();
    expect(() =>
      assertIncomeFundingWallet({ type: PaymentMethodType.DEBIT_CARD }),
    ).not.toThrow();
  });

  it('rejects credit cards', () => {
    expect(() =>
      assertIncomeFundingWallet({ type: PaymentMethodType.CREDIT_CARD }),
    ).toThrow(INCOME_WALLET_TYPE_MESSAGE);
  });
});
