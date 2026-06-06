import { describe, expect, it } from 'vitest';
import { createCreditCardPaymentSchema } from './credit-card.schema';

describe('createCreditCardPaymentSchema', () => {
  it('accepts MiCasa calendar dates for credit card payments', () => {
    const parsed = createCreditCardPaymentSchema.parse({
      source_wallet_id: 1,
      amount: 931.55,
      paid_at: '2026-06-05',
      note: null,
      create_fortnight_expense: true,
      category_id: 2,
    });

    expect(parsed.paid_at).toBe('2026-06-05');
  });

  it('rejects display-formatted dates', () => {
    expect(() =>
      createCreditCardPaymentSchema.parse({
        source_wallet_id: 1,
        amount: 931.55,
        paid_at: '05/06/2026',
        create_fortnight_expense: false,
      }),
    ).toThrow();
  });
});
