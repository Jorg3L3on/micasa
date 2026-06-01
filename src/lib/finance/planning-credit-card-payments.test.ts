import { describe, expect, it } from 'vitest';
import {
  formatCardPaymentDescription,
  linkedCardPaymentExpenseIds,
  mapCreditCardPaymentToTransactionRow,
} from '@/lib/finance/planning-credit-card-payments';
import { PaymentMethodType } from '@/generated/prisma/client';

describe('formatCardPaymentDescription', () => {
  it('uses card name when note is empty', () => {
    expect(formatCardPaymentDescription('Mercado Pago', null)).toBe(
      'Pago tarjeta: Mercado Pago',
    );
  });

  it('includes note when present', () => {
    expect(formatCardPaymentDescription('DiDi Card', '  corte mayo  ')).toBe(
      'Pago tarjeta (DiDi Card): corte mayo',
    );
  });
});

describe('linkedCardPaymentExpenseIds', () => {
  it('returns only non-null expense ids', () => {
    expect(
      linkedCardPaymentExpenseIds([
        { expense_id: 1 },
        { expense_id: null },
        { expense_id: 2 },
      ]),
    ).toEqual(new Set([1, 2]));
  });
});

describe('mapCreditCardPaymentToTransactionRow', () => {
  it('maps linked and orphan payments with the same planning row shape', () => {
    const row = mapCreditCardPaymentToTransactionRow({
      id: 5,
      amount: 694.76,
      paid_at: new Date('2026-05-20T12:00:00.000Z'),
      note: null,
      expense_id: 88,
      source_wallet_id: 2,
      credit_card_wallet_id: 7,
      credit_card_wallet: { name: 'Mercado Pago' },
      source_wallet: { name: 'Débito BBVA', type: PaymentMethodType.DEBIT_CARD },
    });

    expect(row).toMatchObject({
      id: 5,
      description: 'Pago tarjeta: Mercado Pago',
      amount: 694.76,
      category: 'Pago a tarjeta',
      paymentMethod: 'Débito BBVA',
      wallet_id: 2,
      wallet_type: PaymentMethodType.DEBIT_CARD,
      planning_row_kind: 'card_payment',
      type: 'expense',
      is_paid: true,
    });
  });
});
