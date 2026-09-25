import { describe, expect, it } from 'vitest';
import {
  quickExpenseSchema,
  updatePaidSchema,
} from '@/schemas/transaction.schema';

const base = {
  name: 'Café',
  categoryId: 2,
  amount: 80,
  date: '2026-09-15',
  isPaid: false,
  applyWalletDelta: true,
};

describe('quickExpenseSchema', () => {
  it('requires a wallet even when the expense is still planned', () => {
    const result = quickExpenseSchema.safeParse({
      ...base,
      paymentMethodId: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes('billetera'),
        ),
      ).toBe(true);
    }
  });

  it('accepts a funding wallet and the chosen civil date', () => {
    const result = quickExpenseSchema.safeParse({
      ...base,
      paymentMethodId: 4,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe('2026-09-15');
      expect(result.data.paymentMethodId).toBe(4);
    }
  });
});

describe('updatePaidSchema', () => {
  it('accepts paid without a wallet-delta flag', () => {
    const result = updatePaidSchema.safeParse({ paid: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apply_wallet_delta).toBeUndefined();
    }
  });

  it('accepts marking paid without debiting the wallet', () => {
    const result = updatePaidSchema.safeParse({
      paid: true,
      apply_wallet_delta: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apply_wallet_delta).toBe(false);
    }
  });
});
