import { describe, expect, it } from 'vitest';
import {
  countLoansByStatus,
  getLoanEndYmd,
  getLoanHealth,
  getWorstHealth,
  summarizeLoanGroup,
} from '@/lib/finance/loan-list-summary';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

const TODAY = '2026-11-07';

const payment = (
  sequence: number,
  dueDate: string,
  status: LoanPaymentListItem['status'] = 'SCHEDULED',
  amount = 100,
): LoanPaymentListItem => ({
  id: sequence,
  loanId: 1,
  sequence,
  dueDate,
  amount,
  status,
  paidAt: null,
  sourceWalletId: null,
  sourceWalletName: null,
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
});

const loan = (overrides: Partial<LoanListItem> = {}): LoanListItem => ({
  id: 1,
  name: 'Préstamo',
  lender: 'Banco',
  lenderId: 1,
  type: 'PAYROLL',
  status: 'ACTIVE',
  principalAmount: 400,
  totalPayable: 400,
  paymentAmount: 100,
  paymentCount: 4,
  frequency: 'FORTNIGHTLY',
  startDate: '2026-10-01',
  paymentSource: 'PAYROLL_DEDUCTION',
  sourceWalletId: null,
  sourceWalletName: null,
  linkedWalletId: null,
  linkedWalletName: null,
  incomeTemplateId: null,
  incomeTemplateName: null,
  notes: null,
  paidAmount: 100,
  remainingAmount: 300,
  paidPayments: 1,
  remainingPayments: 3,
  overduePayment: null,
  nextPayment: null,
  payments: [
    payment(1, '2026-10-01', 'PAID'),
    payment(2, '2026-10-16'),
    payment(3, '2026-11-01'),
    payment(4, '2026-11-16'),
  ],
  ...overrides,
});

describe('summarizeLoanGroup', () => {
  it('sums overdue, next, pending and progress for active loans', () => {
    const summary = summarizeLoanGroup(
      [
        loan(),
        loan({
          id: 2,
          status: 'PAID_OFF',
          remainingAmount: 0,
          paidPayments: 4,
          payments: [],
        }),
      ],
      TODAY,
    );
    expect(summary.pending).toBe(300);
    expect(summary.total).toBe(400);
    expect(summary.overdue).toEqual({
      amount: 200,
      count: 2,
      firstDate: '2026-10-16',
      lastDate: '2026-11-01',
    });
    expect(summary.next).toMatchObject({
      amount: 100,
      date: '2026-11-16',
      daysLeft: 9,
      source: 'nómina',
    });
    expect(summary.paidInstallments).toBe(1);
    expect(summary.totalInstallments).toBe(4);
    // Three installments were due before today: the bar marker sits at 75 %.
    expect(summary.expectedPct).toBe(75);
    expect(summary.endYmd).toBe('2026-11-16');
    expect(summary.activeCount).toBe(1);
    expect(summary.health).toBe('overdue');
  });

  it('adds up every installment due on the same next date', () => {
    const summary = summarizeLoanGroup(
      [
        loan({ payments: [payment(1, '2026-11-16')] }),
        loan({
          id: 2,
          paymentSource: 'WALLET',
          sourceWalletName: 'Efectivo',
          payments: [payment(1, '2026-11-16', 'SCHEDULED', 50)],
        }),
      ],
      TODAY,
    );
    expect(summary.next).toMatchObject({ amount: 150, source: null });
  });

  it('falls back to the overdue/next cues without a schedule', () => {
    const summary = summarizeLoanGroup(
      [
        loan({
          payments: undefined,
          overduePayment: payment(2, '2026-10-16'),
          nextPayment: payment(4, '2026-11-16'),
        }),
      ],
      TODAY,
    );
    expect(summary.overdue?.count).toBe(1);
    expect(summary.next?.date).toBe('2026-11-16');
    expect(summary.expectedPct).toBeNull();
  });
});

describe('health', () => {
  it('ranks vencido > pronto > al día > pausado > liquidado', () => {
    const soon = loan({ payments: [payment(1, '2026-11-10')] });
    const ok = loan({ payments: [payment(1, '2026-12-16')] });
    const paused = loan({ status: 'PAUSED' });
    const paid = loan({ status: 'PAID_OFF' });
    expect(getLoanHealth(soon, TODAY)).toBe('soon');
    expect(getLoanHealth(ok, TODAY)).toBe('ok');
    expect(getWorstHealth([paid, paused], TODAY)).toBe('paused');
    expect(getWorstHealth([paid, ok, soon], TODAY)).toBe('soon');
    expect(getWorstHealth([ok, loan()], TODAY)).toBe('overdue');
    expect(getWorstHealth([], TODAY)).toBeNull();
  });
});

describe('getLoanEndYmd', () => {
  it('uses the last scheduled installment, else the schedule inputs', () => {
    expect(getLoanEndYmd(loan())).toBe('2026-11-16');
    expect(
      getLoanEndYmd(
        loan({ payments: undefined, startDate: '2026-11-15', frequency: 'MONTHLY', paymentCount: 3 }),
      ),
    ).toBe('2027-01-15');
  });
});

describe('countLoansByStatus', () => {
  it('counts each status', () => {
    expect(
      countLoansByStatus([loan(), loan({ status: 'PAID_OFF' }), loan({ status: 'ACTIVE' })]),
    ).toEqual({ ACTIVE: 2, PAUSED: 0, PAID_OFF: 1, CANCELLED: 0 });
  });
});
