import { describe, expect, it } from 'vitest';
import { lenderNextCommitment } from '@/lib/finance/lender-next-commitment';
import type { LenderPayWindowView } from '@/types/lenders';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

const emptyWindow: LenderPayWindowView = {
  amount: 0,
  commitmentDate: null,
  commitmentDateEnd: null,
  isRange: false,
  canPay: false,
  included: [],
};

const walletWindow: LenderPayWindowView = {
  amount: 4759.61,
  commitmentDate: '2026-10-01',
  commitmentDateEnd: '2026-10-01',
  isRange: false,
  canPay: true,
  included: [],
};

const nextPayment = (
  overrides: Partial<LoanPaymentListItem> & Pick<LoanPaymentListItem, 'id' | 'dueDate' | 'amount'>,
): LoanPaymentListItem => ({
  loanId: 1,
  sequence: 1,
  status: 'SCHEDULED',
  paidAt: null,
  sourceWalletId: null,
  sourceWalletName: null,
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
  ...overrides,
});

const loan = (
  overrides: Partial<Pick<LoanListItem, 'status' | 'paymentSource' | 'nextPayment'>>,
): Pick<LoanListItem, 'status' | 'paymentSource' | 'nextPayment'> => ({
  status: 'ACTIVE',
  paymentSource: 'PAYROLL_DEDUCTION',
  nextPayment: nextPayment({ id: 1, dueDate: '2026-10-01', amount: 1243.68 }),
  ...overrides,
});

describe('lenderNextCommitment', () => {
  it('uses the wallet pay window when Pagar is available', () => {
    const result = lenderNextCommitment(walletWindow, [
      loan({
        paymentSource: 'WALLET',
        nextPayment: nextPayment({ id: 2, dueDate: '2026-11-01', amount: 900 }),
      }),
    ]);

    expect(result).toEqual({
      kind: 'wallet',
      amount: 4759.61,
      date: '2026-10-01',
      dateEnd: '2026-10-01',
      isRange: false,
    });
  });

  it('sums active payroll next payments when there is no wallet window', () => {
    const result = lenderNextCommitment(emptyWindow, [
      loan({
        nextPayment: nextPayment({ id: 10, dueDate: '2026-10-01', amount: 1243.68 }),
      }),
      loan({
        nextPayment: nextPayment({ id: 11, dueDate: '2026-10-01', amount: 1243.68 }),
      }),
      loan({
        status: 'PAUSED',
        nextPayment: nextPayment({ id: 12, dueDate: '2026-10-01', amount: 500 }),
      }),
    ]);

    expect(result.kind).toBe('payroll');
    expect(result.amount).toBe(2487.36);
    expect(result.date).toBe('2026-10-01');
    expect(result.isRange).toBe(false);
  });

  it('returns none when nothing is due', () => {
    expect(lenderNextCommitment(emptyWindow, [loan({ nextPayment: null })])).toEqual({
      kind: 'none',
      amount: 0,
      date: null,
      dateEnd: null,
      isRange: false,
    });
  });

  it('marks mixed non-window dues as scheduled instead of payroll', () => {
    const result = lenderNextCommitment(emptyWindow, [
      loan({
        paymentSource: 'WALLET',
        nextPayment: nextPayment({ id: 20, dueDate: '2026-11-05', amount: 100 }),
      }),
      loan({
        paymentSource: 'PAYROLL_DEDUCTION',
        nextPayment: nextPayment({ id: 21, dueDate: '2026-11-15', amount: 50 }),
      }),
    ]);

    expect(result.kind).toBe('scheduled');
    expect(result.amount).toBe(150);
    expect(result.date).toBe('2026-11-05');
    expect(result.dateEnd).toBe('2026-11-15');
    expect(result.isRange).toBe(true);
  });
});
