import { describe, expect, it } from 'vitest';
import {
  createBudgetSchema,
  step2Schema,
  updateBudgetAllocationsSchema,
} from './budget.schema';

const allocationsWithZeroAmount = [
  { wallet_id: 1, category_id: 1, amount: 100 },
  { wallet_id: 2, category_id: 2, amount: 0 },
];

describe('budget allocation validation', () => {
  it('rejects zero-amount allocations when creating a budget', () => {
    const result = createBudgetSchema.safeParse({
      name: 'Transporte',
      allocated_amount: 100,
      frequency: 'BIWEEKLY',
      recurrent: true,
      allocations: allocationsWithZeroAmount,
    });

    expect(result.success).toBe(false);
  });

  it('rejects zero-amount allocations in the creation allocation step', () => {
    expect(
      step2Schema.safeParse({ allocations: allocationsWithZeroAmount }).success,
    ).toBe(false);
  });

  it('rejects zero-amount allocations when updating allocations', () => {
    expect(
      updateBudgetAllocationsSchema.safeParse({
        allocations: allocationsWithZeroAmount,
      }).success,
    ).toBe(false);
  });
});
