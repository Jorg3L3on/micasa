import { describe, expect, it } from 'vitest';

import {
  countKnownPendingCardDues,
  mapPendingCardDueToTransactionRow,
} from '@/lib/finance/planning-pending-card-payments';
import type { DuePaymentItem } from '@/types/catalog';

const card = (
  overrides: Partial<DuePaymentItem> & Pick<DuePaymentItem, 'walletId' | 'walletName'>,
): DuePaymentItem => ({
  walletType: 'CREDIT_CARD',
  dueDay: 29,
  cutoff_day: 14,
  nextDuePayment: 2100,
  paymentsAppliedToStatement: 0,
  statementDueDate: '2026-09-29',
  outstandingBalance: 4800,
  remainingPlannerAmount: 2100,
  plannerStatus: 'por_pagar',
  statementPayoff: 2100,
  ...overrides,
});

describe('mapPendingCardDueToTransactionRow', () => {
  it('turns a known planned card payment into an unpaid list row', () => {
    const row = mapPendingCardDueToTransactionRow(
      card({ walletId: 8, walletName: 'Tarjeta del hogar' }),
    );

    expect(row).toMatchObject({
      id: -8,
      description: 'Pago tarjeta: Tarjeta del hogar',
      amount: 2100,
      planning_row_kind: 'card_payment',
      type: 'expense',
      is_paid: false,
      wallet_type: null,
    });
  });

  it('skips a gap with no known cash so the counter stays at zero', () => {
    expect(
      mapPendingCardDueToTransactionRow(
        card({
          walletId: 3,
          walletName: 'Tarjeta digital',
          remainingPlannerAmount: 0,
          nextDuePayment: 0,
          statementPayoff: null,
          plannerStatus: 'falta_dato',
        }),
      ),
    ).toBeNull();
    expect(
      countKnownPendingCardDues([
        card({ walletId: 8, walletName: 'Tarjeta del hogar' }),
        card({
          walletId: 3,
          walletName: 'Tarjeta digital',
          remainingPlannerAmount: 0,
          nextDuePayment: 0,
          statementPayoff: null,
          plannerStatus: 'falta_dato',
        }),
      ]),
    ).toBe(1);
  });
});
