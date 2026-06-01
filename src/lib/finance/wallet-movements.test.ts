import { describe, expect, it } from 'vitest';
import {
  computeMovementTotals,
  linkedSourceWalletCardPaymentExpenseIds,
  mapCardPaymentToWalletMovement,
} from '@/lib/finance/wallet-movements';

const basePayment = {
  id: 10,
  amount: 500,
  paid_at: new Date('2026-05-15T12:00:00.000Z'),
  note: null as string | null,
  expense_id: null as number | null,
  source_wallet_id: 2,
  credit_card_wallet_id: 7,
  credit_card_wallet: { name: 'Mercado Pago' },
  source_wallet: { name: 'Efectivo' },
};

describe('linkedSourceWalletCardPaymentExpenseIds', () => {
  it('collects expense ids for linked payments on the source wallet', () => {
    const ids = linkedSourceWalletCardPaymentExpenseIds(
      [
        { ...basePayment, expense_id: 99, source_wallet_id: 2 },
        { ...basePayment, id: 11, expense_id: null, source_wallet_id: 2 },
        { ...basePayment, id: 12, expense_id: 100, source_wallet_id: 3 },
      ],
      2,
    );
    expect(ids).toEqual(new Set([99]));
  });
});

describe('mapCardPaymentToWalletMovement', () => {
  it('maps source wallet payment as cash outflow', () => {
    const movement = mapCardPaymentToWalletMovement(basePayment, 2);
    expect(movement).toMatchObject({
      id: 10,
      kind: 'card_payment',
      direction: 'out',
      amount: 500,
      category: 'Pago a tarjeta',
      description: 'Pago tarjeta: Mercado Pago',
    });
  });

  it('maps credit card wallet payment as debt reduction inflow', () => {
    const movement = mapCardPaymentToWalletMovement(
      { ...basePayment, note: 'Estado de cuenta' },
      7,
    );
    expect(movement).toMatchObject({
      kind: 'card_payment',
      direction: 'in',
      description: 'Abono desde Efectivo: Estado de cuenta',
    });
  });

  it('returns null when wallet is unrelated to the payment', () => {
    expect(mapCardPaymentToWalletMovement(basePayment, 99)).toBeNull();
  });
});

describe('computeMovementTotals', () => {
  it('includes card payment inflows and outflows', () => {
    const totals = computeMovementTotals([
      {
        id: 1,
        kind: 'expense',
        date: '2026-05-01',
        description: 'Compra',
        amount: 100,
        direction: 'out',
        category: null,
        categoryIcon: null,
        fortnightYear: null,
        fortnightMonth: null,
        fortnightPeriod: null,
      },
      {
        id: 2,
        kind: 'card_payment',
        date: '2026-05-02',
        description: 'Pago tarjeta',
        amount: 250,
        direction: 'out',
        category: 'Pago a tarjeta',
        categoryIcon: '💳',
        fortnightYear: null,
        fortnightMonth: null,
        fortnightPeriod: null,
      },
      {
        id: 3,
        kind: 'card_payment',
        date: '2026-05-03',
        description: 'Abono',
        amount: 250,
        direction: 'in',
        category: 'Pago a tarjeta',
        categoryIcon: '💳',
        fortnightYear: null,
        fortnightMonth: null,
        fortnightPeriod: null,
      },
    ]);

    expect(totals).toEqual({ inflow: 250, outflow: 350, net: -100 });
  });
});
