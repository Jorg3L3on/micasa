import { describe, expect, it } from 'vitest';
import type { LoanPlanningPayment } from '@/lib/finance/loan.service';
import {
  applyWalletLoanDueToExpenseTotals,
  partitionLoanPaymentsForPlanningTotals,
} from '@/lib/finance/planning-period-loan-totals';

const walletScheduled: LoanPlanningPayment = {
  id: 1,
  loanId: 10,
  loanName: 'DiDi',
  lender: 'DiDi',
  amount: 200,
  dueDate: '2026-06-10',
  paidAt: null,
  status: 'SCHEDULED',
  paymentSource: 'WALLET',
  sourceWalletId: 5,
  sourceWalletName: 'BBVA',
  linkedExpenseId: null,
};

const payrollScheduled: LoanPlanningPayment = {
  id: 2,
  loanId: 11,
  loanName: 'FONACOT',
  lender: 'Banco',
  amount: 2792.73,
  dueDate: '2026-06-15',
  paidAt: null,
  status: 'SCHEDULED',
  paymentSource: 'PAYROLL_DEDUCTION',
  sourceWalletId: null,
  sourceWalletName: null,
  linkedExpenseId: null,
};

describe('planning-period-loan-totals', () => {
  it('partitions wallet expenses and payroll deductions separately', () => {
    const result = partitionLoanPaymentsForPlanningTotals([
      walletScheduled,
      payrollScheduled,
    ]);

    expect(result.walletDue).toEqual({ total: 200, count: 1 });
    expect(result.payrollDeduction).toEqual({ total: 2792.73, count: 1 });
  });

  it('does not count paid wallet payments that already have a linked expense', () => {
    const result = partitionLoanPaymentsForPlanningTotals([
      {
        ...walletScheduled,
        status: 'PAID',
        paidAt: '2026-06-10',
        linkedExpenseId: 99,
      },
    ]);

    expect(result.walletDue).toEqual({ total: 0, count: 0 });
  });

  it('adds pending wallet loan installments to expense totals only', () => {
    const totals = applyWalletLoanDueToExpenseTotals(
      { totalExpense: 1000, totalPaid: 400, totalUnpaid: 600 },
      { total: 200, count: 1 },
    );

    expect(totals).toEqual({
      totalExpense: 1200,
      totalPaid: 400,
      totalUnpaid: 800,
    });
  });
});
