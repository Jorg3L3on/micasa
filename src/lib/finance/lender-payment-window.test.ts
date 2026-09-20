import { describe, expect, it } from 'vitest';
import {
  groupDuePaymentsByLender,
  selectLenderPayWindow,
  type LenderWindowPayment,
} from '@/lib/finance/lender-payment-window';

const pay = (
  overrides: Partial<LenderWindowPayment> & Pick<LenderWindowPayment, 'id' | 'loanId' | 'dueDate' | 'amount'>,
): LenderWindowPayment => ({
  loanName: `Loan ${overrides.loanId}`,
  sequence: 1,
  paymentSource: 'WALLET',
  loanStatus: 'ACTIVE',
  status: 'SCHEDULED',
  ...overrides,
});

describe('selectLenderPayWindow', () => {
  it('pays all wallet dues in the anchor month plus overdue', () => {
    const window = selectLenderPayWindow(
      [
        pay({ id: 1, loanId: 10, dueDate: '2026-09-05', amount: 100 }),
        pay({ id: 2, loanId: 11, dueDate: '2026-09-18', amount: 50 }),
        pay({ id: 3, loanId: 11, dueDate: '2026-10-18', amount: 50, sequence: 2 }),
      ],
      '2026-09-01',
    );

    expect(window.included.map((row) => row.id)).toEqual([1, 2]);
    expect(window.amount).toBe(150);
    expect(window.commitmentDate).toBe('2026-09-05');
    expect(window.commitmentDateEnd).toBe('2026-09-18');
    expect(window.isRange).toBe(true);
  });

  it('uses the overdue month as the pay window so later dues wait', () => {
    const window = selectLenderPayWindow(
      [
        pay({ id: 1, loanId: 10, dueDate: '2026-08-05', amount: 80 }),
        pay({ id: 2, loanId: 11, dueDate: '2026-09-10', amount: 40 }),
      ],
      '2026-09-01',
    );

    expect(window.included.map((row) => row.id)).toEqual([1]);
    expect(window.amount).toBe(80);
    expect(window.isRange).toBe(false);
  });

  it('excludes payroll deductions from Pagar', () => {
    const window = selectLenderPayWindow(
      [
        pay({
          id: 1,
          loanId: 10,
          dueDate: '2026-09-05',
          amount: 200,
          paymentSource: 'PAYROLL_DEDUCTION',
        }),
        pay({ id: 2, loanId: 11, dueDate: '2026-09-05', amount: 30 }),
      ],
      '2026-09-01',
    );

    expect(window.included.map((row) => row.id)).toEqual([2]);
    expect(window.amount).toBe(30);
  });

  it('ignores paused loans and already paid installments', () => {
    const window = selectLenderPayWindow(
      [
        pay({
          id: 1,
          loanId: 10,
          dueDate: '2026-09-05',
          amount: 90,
          loanStatus: 'PAUSED',
        }),
        pay({
          id: 2,
          loanId: 11,
          dueDate: '2026-09-05',
          amount: 40,
          status: 'PAID',
        }),
        pay({ id: 3, loanId: 11, dueDate: '2026-10-05', amount: 40, sequence: 2 }),
      ],
      '2026-09-20',
    );

    expect(window.included.map((row) => row.id)).toEqual([3]);
    expect(window.amount).toBe(40);
  });

  it('includes every overdue installment even when the anchor month is earlier', () => {
    const window = selectLenderPayWindow(
      [
        pay({ id: 1, loanId: 10, dueDate: '2026-07-05', amount: 80 }),
        pay({ id: 2, loanId: 11, dueDate: '2026-08-10', amount: 40 }),
        pay({ id: 3, loanId: 11, dueDate: '2026-09-10', amount: 40, sequence: 2 }),
      ],
      '2026-09-01',
    );

    expect(window.included.map((row) => row.id)).toEqual([1, 2]);
    expect(window.amount).toBe(120);
  });

  it('only takes the next upcoming installment per contract', () => {
    const window = selectLenderPayWindow(
      [
        pay({ id: 1, loanId: 10, dueDate: '2026-09-01', amount: 10, sequence: 1 }),
        pay({ id: 2, loanId: 10, dueDate: '2026-09-16', amount: 10, sequence: 2 }),
      ],
      '2026-08-20',
    );

    expect(window.included.map((row) => row.id)).toEqual([1]);
  });
});

describe('groupDuePaymentsByLender', () => {
  it('sums same-lender dues without double-counting identities', () => {
    const groups = groupDuePaymentsByLender([
      {
        id: 1,
        lenderId: 7,
        lender: 'Mercado Libre',
        amount: 100,
        dueDate: '2026-09-05',
        status: 'SCHEDULED',
        paymentSource: 'WALLET',
      },
      {
        id: 2,
        lenderId: 7,
        lender: 'Mercado Libre',
        amount: 80,
        dueDate: '2026-09-05',
        status: 'SCHEDULED',
        paymentSource: 'WALLET',
      },
      {
        id: 3,
        lenderId: 8,
        lender: 'Banamex',
        amount: 50,
        dueDate: '2026-09-10',
        status: 'SCHEDULED',
        paymentSource: 'WALLET',
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      lenderId: 7,
      amount: 180,
      isRange: false,
    });
    expect(groups[1]).toMatchObject({ lenderId: 8, amount: 50 });
  });
});
