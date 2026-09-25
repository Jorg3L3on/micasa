import { describe, expect, it } from 'vitest';
import { createOverrideAmountFormSchema } from '@/schemas/fortnight.schema';

const incomeEditSchema = createOverrideAmountFormSchema({
  requireCategory: true,
});

describe('createOverrideAmountFormSchema income edit', () => {
  it('blocks save when the category is empty', () => {
    const result = incomeEditSchema.safeParse({
      amount: 12000,
      categoryId: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes('categoría es requerida'),
        ),
      ).toBe(true);
    }
  });

  it('requires a wallet on the template edit', () => {
    const schema = createOverrideAmountFormSchema({
      requireCategory: true,
      requireWallet: true,
    });
    const missing = schema.safeParse({
      amount: 12500,
      categoryId: 3,
      walletId: null,
    });
    expect(missing.success).toBe(false);

    const saved = schema.safeParse({
      amount: 12500,
      categoryId: 3,
      walletId: 7,
    });
    expect(saved.success).toBe(true);
  });
});
