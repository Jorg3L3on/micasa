import { describe, expect, it } from 'vitest';
import { formatLoanDueYmd, loanDueDateForStorage } from '@/lib/finance/loan-schedule';
import {
  partitionScheduledInstallments,
  summarizeInstallmentCues,
} from '@/lib/finance/loan-installment-cues';
import type { LoanPaymentListItem } from '@/types/loans';

const payment = (
  overrides: Partial<LoanPaymentListItem> &
    Pick<LoanPaymentListItem, 'id' | 'dueDate' | 'status'>,
): LoanPaymentListItem => ({
  loanId: 1,
  sequence: overrides.id,
  amount: 500,
  paidAt: null,
  sourceWalletId: null,
  sourceWalletName: null,
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
  ...overrides,
});

describe('loan installment civil dates', () => {
  it('shows the same civil day for 00:00 UTC and 06:00 UTC', () => {
    const midnight = new Date('2026-09-01T00:00:00.000Z');
    const mexicoMidnight = new Date('2026-09-01T06:00:00.000Z');

    expect(formatLoanDueYmd(midnight)).toBe('2026-09-01');
    expect(formatLoanDueYmd(mexicoMidnight)).toBe('2026-09-01');
    expect(loanDueDateForStorage(midnight).toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(loanDueDateForStorage(mexicoMidnight).toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });
});

describe('loan installment cues', () => {
  const today = '2026-09-25';

  it('marks an old unpaid installment as overdue and the next future one as próximo', () => {
    const rows = [
      payment({ id: 1, dueDate: '2026-08-01', status: 'SCHEDULED' }),
      payment({ id: 2, dueDate: '2026-09-01', status: 'PAID', paidAt: '2026-09-01' }),
      payment({ id: 3, dueDate: '2026-10-01', status: 'SCHEDULED' }),
    ];

    const summary = summarizeInstallmentCues(rows, today);
    const parts = partitionScheduledInstallments(rows, today);

    expect(parts.overdue.map((row) => row.id)).toEqual([1]);
    expect(parts.upcoming.map((row) => row.id)).toEqual([3]);
    expect(summary.overdue).toMatchObject({ amount: 500, date: '2026-08-01', count: 1 });
    expect(summary.next).toMatchObject({ amount: 500, date: '2026-10-01', count: 1 });
  });

  it('has no overdue cue when every installment is paid or still due', () => {
    const paid = [
      payment({ id: 1, dueDate: '2026-08-01', status: 'PAID', paidAt: '2026-08-01' }),
      payment({ id: 2, dueDate: '2026-09-01', status: 'PAID', paidAt: '2026-09-01' }),
    ];
    expect(summarizeInstallmentCues(paid, today)).toEqual({ overdue: null, next: null });

    const futureOnly = [
      payment({ id: 3, dueDate: '2026-10-01', status: 'SCHEDULED' }),
      payment({ id: 4, dueDate: '2026-11-01', status: 'SCHEDULED' }),
    ];
    const summary = summarizeInstallmentCues(futureOnly, today);
    expect(summary.overdue).toBeNull();
    expect(summary.next).toMatchObject({ date: '2026-10-01', count: 1 });
  });

  it('keeps one future installment per loan and every past-due installment', () => {
    const rows = [
      payment({ id: 1, loanId: 1, dueDate: '2026-08-01', status: 'SCHEDULED', amount: 100 }),
      payment({ id: 2, loanId: 1, dueDate: '2026-10-01', status: 'SCHEDULED', amount: 100 }),
      payment({ id: 3, loanId: 1, dueDate: '2026-11-01', status: 'SCHEDULED', amount: 100 }),
      payment({ id: 4, loanId: 2, dueDate: '2026-10-15', status: 'SCHEDULED', amount: 200 }),
    ];
    const summary = summarizeInstallmentCues(rows, today, { perLoanNext: true });
    expect(summary.overdue).toMatchObject({ amount: 100, date: '2026-08-01', count: 1 });
    expect(summary.next).toMatchObject({
      amount: 300,
      date: '2026-10-01',
      dateEnd: '2026-10-15',
      isRange: true,
      count: 2,
    });
  });

  it('does not treat an installment due today as overdue', () => {
    const rows = [
      payment({ id: 1, dueDate: '2026-09-25', status: 'SCHEDULED' }),
      payment({ id: 2, dueDate: '2026-10-25', status: 'SCHEDULED' }),
    ];
    const summary = summarizeInstallmentCues(rows, today);
    expect(summary.overdue).toBeNull();
    expect(summary.next).toMatchObject({ date: '2026-09-25', count: 1 });
  });
});
