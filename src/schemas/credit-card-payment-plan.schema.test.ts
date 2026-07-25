import { describe, expect, it } from 'vitest';
import {
  cardPaymentPlanFormSchema,
  cardPaymentPlanSchema,
} from '@/schemas/credit-card-payment-plan.schema';

describe('cardPaymentPlanSchema', () => {
  it('accepts a positive planned amount', () => {
    const parsed = cardPaymentPlanSchema.parse({
      walletId: 26,
      plannedAmount: 500.5,
    });
    expect(parsed.plannedAmount).toBe(500.5);
  });

  it('rejects plannedAmount of 0', () => {
    const result = cardPaymentPlanSchema.safeParse({
      walletId: 26,
      plannedAmount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative plannedAmount', () => {
    const result = cardPaymentPlanSchema.safeParse({
      walletId: 26,
      plannedAmount: -10,
    });
    expect(result.success).toBe(false);
  });
});

describe('cardPaymentPlanFormSchema', () => {
  it('rejects 0 with a clear message', () => {
    const result = cardPaymentPlanFormSchema.safeParse({ plannedAmount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/mayor a 0/i);
    }
  });
});
