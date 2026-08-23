import { describe, expect, it } from 'vitest';
import {
  createCreditCardPaymentSchema,
  createCreditCardPurchaseSchema,
} from './credit-card.schema';

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

describe('createCreditCardPurchaseSchema already_in_card_balance', () => {
  const base = {
    fortnight_id: 1,
    category_id: 2,
    description: 'Cargo',
    amount: 120,
    payment_date: '2026-08-20',
  };

  it('defaults already_in_card_balance to false', () => {
    const parsed = createCreditCardPurchaseSchema.parse(base);
    expect(parsed.already_in_card_balance).toBe(false);
  });

  it('accepts already_in_card_balance true for ledger-only purchases', () => {
    const parsed = createCreditCardPurchaseSchema.parse({
      ...base,
      already_in_card_balance: true,
    });
    expect(parsed.already_in_card_balance).toBe(true);
  });
});
