import { describe, expect, it } from 'vitest';
import { expenseAmountSchema } from './expense.schema';

describe('expenseAmountSchema', () => {
  it('requires a name and a valid payment date', () => {
    const parsed = expenseAmountSchema.parse({
      amount: 120,
      wallet_id: 3,
      description: '  Super  ',
      payment_date: '2026-10-05',
    });

    expect(parsed).toEqual({
      amount: 120,
      wallet_id: 3,
      description: 'Super',
      payment_date: '2026-10-05',
    });
  });

  it('rejects an empty name', () => {
    const result = expenseAmountSchema.safeParse({
      amount: 50,
      description: '   ',
      payment_date: '2026-10-05',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid payment date', () => {
    const result = expenseAmountSchema.safeParse({
      amount: 50,
      description: 'Café',
      payment_date: '2026-13-40',
    });

    expect(result.success).toBe(false);
  });
});
