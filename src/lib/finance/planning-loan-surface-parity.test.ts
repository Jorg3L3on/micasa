import { describe, expect, it } from 'vitest';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import {
  applyWalletLoanDueToExpenseTotals,
  partitionLoanPaymentsForPlanningTotals,
} from '@/lib/finance/planning-period-loan-totals';
import type { LoanPlanningPayment } from '@/lib/finance/loan.service';

/**
 * Mirrors how report-summary and dashboard compose planner totals.
 */
const buildPlannerBalance = (input: {
  income: number;
  baseExpense: number;
  basePaid: number;
  cardDue: number;
  walletLoanDue: number;
  payrollDeduction: number;
}) => {
  const withCards = mergePlanningCardTotalsIntoExpenseSummary(
    {
      totalExpense: input.baseExpense,
      totalPaid: input.basePaid,
      totalUnpaid: input.baseExpense - input.basePaid,
    },
    null,
    input.cardDue > 0
      ? { total: input.cardDue, cardCount: 1 }
      : null,
  );
  const withLoans = applyWalletLoanDueToExpenseTotals(
    withCards,
    input.walletLoanDue > 0
      ? { total: input.walletLoanDue, count: 1 }
      : null,
  );

  const balance =
    input.income - input.payrollDeduction - withLoans.totalExpense;
  const fundingNet = 5000 - withLoans.totalUnpaid - input.payrollDeduction;
  const libreFromIncome =
    input.income -
    withLoans.totalPaid -
    withLoans.totalUnpaid -
    input.payrollDeduction;

  return { withLoans, balance, fundingNet, libreFromIncome };
};

describe('planning loan surface parity', () => {
  it('keeps payroll on the income side and wallet loans on the expense side', () => {
    const payroll: LoanPlanningPayment = {
      id: 1,
      loanId: 10,
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
    const wallet: LoanPlanningPayment = {
      id: 2,
      loanId: 11,
      loanName: 'DiDi',
      lender: 'DiDi',
      amount: 200,
      dueDate: '2026-06-10',
      paidAt: null,
      status: 'SCHEDULED',
      paymentSource: 'WALLET',
      sourceWalletId: 3,
      sourceWalletName: 'BBVA',
      linkedExpenseId: null,
    };

    const parts = partitionLoanPaymentsForPlanningTotals([payroll, wallet]);
    expect(parts.payrollDeduction.total).toBe(2792.73);
    expect(parts.walletDue.total).toBe(200);

    const result = buildPlannerBalance({
      income: 21400,
      baseExpense: 1000,
      basePaid: 400,
      cardDue: 500,
      walletLoanDue: parts.walletDue.total,
      payrollDeduction: parts.payrollDeduction.total,
    });

    expect(result.withLoans.totalExpense).toBe(1700);
    expect(result.withLoans.totalUnpaid).toBe(1300);
    expect(result.balance).toBe(16907.27);
    expect(result.libreFromIncome).toBe(16907.27);
    expect(result.fundingNet).toBe(907.27);
  });

  it('does not double-count paid wallet loans that already have a linked expense', () => {
    const parts = partitionLoanPaymentsForPlanningTotals([
      {
        id: 3,
        loanId: 12,
        loanName: 'Auto',
        lender: 'Banco',
        amount: 150,
        dueDate: '2026-06-08',
        paidAt: '2026-06-08',
        status: 'PAID',
        paymentSource: 'WALLET',
        sourceWalletId: 3,
        sourceWalletName: 'BBVA',
        linkedExpenseId: 99,
      },
    ]);

    expect(parts.walletDue.total).toBe(0);
    expect(parts.payrollDeduction.total).toBe(0);
  });
});
