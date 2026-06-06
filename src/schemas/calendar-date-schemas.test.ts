import { describe, expect, it } from 'vitest';
import { dateStringSchema } from './common.schema';
import {
  addExpenseSchema,
  createTransactionSchema,
  updateTransactionSchema,
} from './transaction.schema';
import {
  createLoanSchema,
  updateLoanPaymentSchema,
} from './loan.schema';
import { registerPantryReceiptExpenseBodySchema } from './pantry-receipt-expense.schema';

describe('calendar date schemas', () => {
  it('accepts valid MiCasa calendar dates', () => {
    expect(dateStringSchema.parse('2026-06-05')).toBe('2026-06-05');
  });

  it('rejects display-formatted and impossible dates', () => {
    expect(() => dateStringSchema.parse('05/06/2026')).toThrow();
    expect(() => dateStringSchema.parse('2026-02-31')).toThrow();
  });

  it('validates transaction and quick expense date fields with the shared rule', () => {
    expect(
      createTransactionSchema.parse({
        fortnight_id: 1,
        category_id: 2,
        description: 'Despensa',
        amount: 100,
        is_paid: true,
        payment_date: '2026-06-05',
      }).payment_date,
    ).toBe('2026-06-05');

    expect(() =>
      updateTransactionSchema.parse({ payment_date: '05/06/2026' }),
    ).toThrow();

    expect(() =>
      addExpenseSchema.parse({
        name: 'Despensa',
        categoryId: 2,
        amount: 100,
        paymentMethodId: 3,
        date: '2026-02-31',
        isPaid: true,
        isRecurring: false,
        applyToBothFortnights: false,
      }),
    ).toThrow();
  });

  it('validates loan and pantry receipt expense date fields with the shared rule', () => {
    expect(
      createLoanSchema.parse({
        name: 'Nomina',
        lender: 'Banco',
        type: 'PERSONAL',
        principalAmount: 1000,
        paymentAmount: 100,
        paymentCount: 10,
        frequency: 'MONTHLY',
        startDate: '2026-06-05',
        paymentSource: 'WALLET',
        sourceWalletId: 1,
      }).startDate,
    ).toBe('2026-06-05');

    expect(() =>
      updateLoanPaymentSchema.parse({
        action: 'MARK_PAID',
        paidAt: '05/06/2026',
      }),
    ).toThrow();

    expect(() =>
      registerPantryReceiptExpenseBodySchema.parse({
        categoryId: 1,
        walletId: 2,
        date: '2026-02-31',
      }),
    ).toThrow();
  });
});
