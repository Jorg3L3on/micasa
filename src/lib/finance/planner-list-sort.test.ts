import { describe, expect, it } from 'vitest';
import {
  nextPlannerListSortPreference,
  sortCardDuePaymentRows,
  sortExpenseListRows,
  sortLoanDuePaymentRows,
} from './planner-list-sort';
import type { DuePaymentItem } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';

describe('nextPlannerListSortPreference', () => {
  it('switches field with default direction', () => {
    expect(
      nextPlannerListSortPreference({ mode: 'amount', dir: 'desc' }, 'due_day'),
    ).toEqual({ mode: 'due_day', dir: 'asc' });
  });

  it('toggles direction when same field is clicked', () => {
    expect(
      nextPlannerListSortPreference({ mode: 'amount', dir: 'desc' }, 'amount'),
    ).toEqual({ mode: 'amount', dir: 'asc' });
    expect(
      nextPlannerListSortPreference({ mode: 'due_day', dir: 'asc' }, 'due_day'),
    ).toEqual({ mode: 'due_day', dir: 'desc' });
  });
});

describe('sortExpenseListRows', () => {
  const rows = [
    { id: 1, is_paid: false, amount: 100, due_day: 15 },
    { id: 2, is_paid: false, amount: 500, due_day: 7 },
    { id: 3, is_paid: true, amount: 900, due_day: 1 },
    { id: 4, is_paid: false, amount: 200, due_day: null },
  ];

  it('sorts unpaid first then by amount desc', () => {
    expect(sortExpenseListRows(rows, 'amount', 'desc').map((r) => r.id)).toEqual([
      2, 4, 1, 3,
    ]);
  });

  it('sorts unpaid first then by amount asc when reversed', () => {
    expect(sortExpenseListRows(rows, 'amount', 'asc').map((r) => r.id)).toEqual([
      1, 4, 2, 3,
    ]);
  });

  it('sorts unpaid first then by due day asc, missing due last', () => {
    expect(
      sortExpenseListRows(rows, 'due_day', 'asc').map((r) => r.id),
    ).toEqual([2, 1, 4, 3]);
  });

  it('sorts unpaid first then by due day desc, missing due still last', () => {
    expect(
      sortExpenseListRows(rows, 'due_day', 'desc').map((r) => r.id),
    ).toEqual([1, 2, 4, 3]);
  });
});

describe('sortCardDuePaymentRows', () => {
  const base = {
    walletName: 'Card',
    walletType: 'CREDIT_CARD',
    dueDay: 10,
    cutoff_day: 5,
    paymentsAppliedToStatement: 0,
    outstandingBalance: 1000,
  };

  const items: DuePaymentItem[] = [
    {
      ...base,
      walletId: 1,
      nextDuePayment: 100,
      remainingPlannerAmount: 100,
      statementDueDate: '2026-08-20',
      plannerStatus: 'por_pagar',
    },
    {
      ...base,
      walletId: 2,
      nextDuePayment: 500,
      remainingPlannerAmount: 500,
      statementDueDate: '2026-08-10',
      plannerStatus: 'por_pagar',
    },
    {
      ...base,
      walletId: 3,
      nextDuePayment: 900,
      remainingPlannerAmount: 0,
      statementDueDate: '2026-08-01',
      plannerStatus: 'pagado',
    },
    {
      ...base,
      walletId: 4,
      nextDuePayment: 50,
      remainingPlannerAmount: 50,
      statementDueDate: '2026-08-05',
      plannerStatus: 'vencido',
    },
  ];

  it('keeps status priority then amount desc', () => {
    expect(
      sortCardDuePaymentRows(items, 'amount', 'desc').map((r) => r.walletId),
    ).toEqual([4, 2, 1, 3]);
  });

  it('keeps status priority then amount asc when reversed', () => {
    expect(
      sortCardDuePaymentRows(items, 'amount', 'asc').map((r) => r.walletId),
    ).toEqual([4, 1, 2, 3]);
  });

  it('keeps status priority then due date asc', () => {
    expect(
      sortCardDuePaymentRows(items, 'due_day', 'asc').map((r) => r.walletId),
    ).toEqual([4, 2, 1, 3]);
  });
});

describe('sortLoanDuePaymentRows', () => {
  const today = '2026-08-10';
  const base = {
    loanId: 1,
    sequence: 1,
    paidAt: null,
    sourceWalletId: null,
    sourceWalletName: null,
    linkedExpenseId: null,
    note: null,
    loanName: 'Loan',
    lender: 'Bank',
    loanType: 'PERSONAL' as const,
    paymentSource: 'WALLET' as const,
    linkedWalletId: null,
    linkedWalletName: null,
    incomeTemplateName: null,
  };

  const items: LoanDuePaymentItem[] = [
    { ...base, id: 1, dueDate: '2026-08-20', amount: 100, status: 'SCHEDULED' },
    { ...base, id: 2, dueDate: '2026-08-12', amount: 500, status: 'SCHEDULED' },
    { ...base, id: 3, dueDate: '2026-08-01', amount: 900, status: 'PAID' },
    { ...base, id: 4, dueDate: '2026-08-05', amount: 50, status: 'SCHEDULED' },
  ];

  it('keeps status priority then amount desc', () => {
    expect(
      sortLoanDuePaymentRows(items, 'amount', 'desc', today).map((r) => r.id),
    ).toEqual([4, 2, 1, 3]);
  });

  it('keeps status priority then due date asc', () => {
    expect(
      sortLoanDuePaymentRows(items, 'due_day', 'asc', today).map((r) => r.id),
    ).toEqual([4, 2, 1, 3]);
  });

  it('reverses due date within status when toggled', () => {
    expect(
      sortLoanDuePaymentRows(items, 'due_day', 'desc', today).map((r) => r.id),
    ).toEqual([4, 1, 2, 3]);
  });
});
