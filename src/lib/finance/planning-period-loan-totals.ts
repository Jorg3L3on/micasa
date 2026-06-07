import type { LoanPlanningPayment } from '@/lib/finance/loan.service';

export type PlanningWalletLoanDue = {
  total: number;
  count: number;
};

export type PlanningPayrollLoanDeduction = {
  total: number;
  count: number;
};

export type PlanningExpenseTotals = {
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
};

const countsTowardWalletExpense = (payment: LoanPlanningPayment) =>
  payment.paymentSource === 'WALLET' &&
  (payment.status === 'SCHEDULED' || payment.linkedExpenseId == null);

const countsTowardPayrollDeduction = (payment: LoanPlanningPayment) =>
  payment.paymentSource === 'PAYROLL_DEDUCTION' && payment.status === 'SCHEDULED';

export const partitionLoanPaymentsForPlanningTotals = (
  payments: LoanPlanningPayment[],
): {
  walletDue: PlanningWalletLoanDue;
  payrollDeduction: PlanningPayrollLoanDeduction;
  walletPaidWithoutExpense: number;
} => {
  let walletDueTotal = 0;
  let walletDueCount = 0;
  let payrollTotal = 0;
  let payrollCount = 0;
  let walletPaidWithoutExpense = 0;

  for (const payment of payments) {
    if (countsTowardWalletExpense(payment)) {
      walletDueTotal += payment.amount;
      walletDueCount += 1;
      if (payment.status === 'PAID') {
        walletPaidWithoutExpense += payment.amount;
      }
    }
    if (countsTowardPayrollDeduction(payment)) {
      payrollTotal += payment.amount;
      payrollCount += 1;
    }
  }

  return {
    walletDue: { total: walletDueTotal, count: walletDueCount },
    payrollDeduction: { total: payrollTotal, count: payrollCount },
    walletPaidWithoutExpense,
  };
};

/** Pending wallet loan installments add to planned cash outflows (like card statement due). */
export const applyWalletLoanDueToExpenseTotals = (
  totals: PlanningExpenseTotals,
  walletDue: PlanningWalletLoanDue | null,
): PlanningExpenseTotals => {
  if (!walletDue || walletDue.total <= 0) {
    return {
      ...totals,
      totalUnpaid: totals.totalExpense - totals.totalPaid,
    };
  }

  const scheduledOnly = walletDue.total;
  const totalExpense = totals.totalExpense + scheduledOnly;
  return {
    totalExpense,
    totalPaid: totals.totalPaid,
    totalUnpaid: totalExpense - totals.totalPaid,
  };
};
