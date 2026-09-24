import { describe, expect, it } from 'vitest';
import { createOverrideAmountFormSchema } from '@/schemas/fortnight.schema';

const incomeEditSchema = createOverrideAmountFormSchema({
  requireCategory: true,
  requireWallet: true,
});

describe('createOverrideAmountFormSchema income edit', () => {
  it('blocks save when the wallet is empty', () => {
    const result = incomeEditSchema.safeParse({
      amount: 12000,
      categoryId: 3,
      walletId: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes('billetera de efectivo o débito'),
        ),
      ).toBe(true);
    }
  });

  it('accepts amount and a funding wallet together', () => {
    const result = incomeEditSchema.safeParse({
      amount: 12500,
      categoryId: 3,
      walletId: 9,
    });

    expect(result.success).toBe(true);
  });
});
