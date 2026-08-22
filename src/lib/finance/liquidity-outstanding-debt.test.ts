import { describe, expect, it } from 'vitest';
import {
  buildMonthOutstandingSnapshot,
  loanRemainingAtAsOf,
} from '@/lib/finance/liquidity-outstanding-debt';
import type { LoanPaymentSnapshot } from '@/lib/finance/liquidity-outstanding-debt';

describe('loanRemainingAtAsOf', () => {
  const payments: LoanPaymentSnapshot[] = [
    {
      loan_id: 1,
      loan_name: 'Fonacot',
      lender: 'FONACOT',
      payment_source: 'PAYROLL_DEDUCTION',
      amount: 1000,
      due_date: new Date(Date.UTC(2026, 3, 16)),
      paid_at: null,
      status: 'SCHEDULED',
    },
    {
      loan_id: 1,
      loan_name: 'Fonacot',
      lender: 'FONACOT',
      payment_source: 'PAYROLL_DEDUCTION',
      amount: 1000,
      due_date: new Date(Date.UTC(2026, 9, 16)),
      paid_at: null,
      status: 'SCHEDULED',
    },
  ];

  it('counts all unpaid cuotas as of a past month-end', () => {
    expect(loanRemainingAtAsOf(payments, '2026-06-30')).toBe(2000);
  });

  it('drops cuotas paid before the as-of date', () => {
    const paidFirst: LoanPaymentSnapshot[] = [
      { ...payments[0]!, status: 'PAID', paid_at: new Date(Date.UTC(2026, 3, 16)) },
      payments[1]!,
    ];
    expect(loanRemainingAtAsOf(paidFirst, '2026-06-30')).toBe(1000);
  });
});

describe('buildMonthOutstandingSnapshot', () => {
  it('combines card balances and loan remaining at month-end', () => {
    const snapshot = buildMonthOutstandingSnapshot({
      monthKey: '2026-06',
      todayYmd: '2026-08-22',
      wallets: [
        { id: 1, name: 'Visa', type: 'CREDIT_CARD', amount: 5000 },
        { id: 2, name: 'Liverpool', type: 'DEPARTMENT_STORE_CARD', amount: 2000 },
      ],
      movementsByWalletId: new Map([
        [1, [{ id: 1, kind: 'expense', date: '2026-07-01', direction: 'out', amount: 500, description: 'x', category: null, categoryIcon: null, fortnightYear: null, fortnightMonth: null, fortnightPeriod: null }]],
        [2, []],
      ]),
      loanPayments: [
        {
          loan_id: 3,
          loan_name: 'Fonacot',
          lender: 'FONACOT',
          payment_source: 'PAYROLL_DEDUCTION',
          amount: 1243.68,
          due_date: new Date(Date.UTC(2026, 9, 16)),
          paid_at: null,
          status: 'SCHEDULED',
        },
      ],
      cardPaymentsByMonth: new Map(),
      loanPaymentsByMonth: new Map(),
    });

    expect(snapshot.outstanding_debt_total).toBeGreaterThan(2000);
    expect(snapshot.debt_items.some((item) => item.kind === 'loan')).toBe(true);
    expect(snapshot.debt_items.some((item) => item.kind === 'card')).toBe(true);
  });
});
