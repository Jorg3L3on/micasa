import { describe, expect, it } from 'vitest';
import { createCreditCardPaymentSchema } from './credit-card.schema';

describe('createCreditCardPaymentSchema', () => {
  it('accepts MiCasa calendar dates for credit card payments', () => {
    const parsed = createCreditCardPaymentSchema.parse({
      mode: 'wallet',
      source_wallet_id: 1,
      amount: 931.55,
      paid_at: '2026-06-05',
      note: null,
      create_fortnight_expense: true,
      category_id: 2,
    });

    expect(parsed).toMatchObject({ paid_at: '2026-06-05' });
  });

  it('accepts external historical payments', () => {
    const parsed = createCreditCardPaymentSchema.parse({
      mode: 'external',
      amount: 100,
      paid_at: '2026-06-05',
      adjusts_debt: false,
    });

    expect(parsed).toMatchObject({
      mode: 'external',
      adjusts_debt: false,
    });
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
