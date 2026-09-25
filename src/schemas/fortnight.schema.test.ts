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

  it('accepts amount and category without a wallet', () => {
    const result = incomeEditSchema.safeParse({
      amount: 12500,
      categoryId: 3,
    });

    expect(result.success).toBe(true);
  });
});
