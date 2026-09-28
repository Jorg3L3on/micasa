import { describe, expect, it } from 'vitest';

/** Mirrors report-summary planning row count composition for loan synthetic rows. */
const composePlanningExpenseCounts = (input: {
  baseExpenseCount: number;
  baseUnpaidCount: number;
  knownCardDueCount: number;
  walletLoanDueCount: number;
  payrollDeductionCount: number;
}) => {
  let planningExpenseCount = input.baseExpenseCount;
  let planningUnpaidExpenseCount = input.baseUnpaidCount;

  if (input.knownCardDueCount > 0) {
    planningExpenseCount += input.knownCardDueCount;
    planningUnpaidExpenseCount += input.knownCardDueCount;
  }
  if (input.walletLoanDueCount > 0) {
    planningExpenseCount += input.walletLoanDueCount;
    planningUnpaidExpenseCount += input.walletLoanDueCount;
  }
  if (input.payrollDeductionCount > 0) {
    planningExpenseCount += input.payrollDeductionCount;
    planningUnpaidExpenseCount += input.payrollDeductionCount;
  }

  return { planningExpenseCount, planningUnpaidExpenseCount };
};

describe('report-summary loan row counts', () => {
  it('includes wallet and payroll synthetic rows in planning expense counts', () => {
    const result = composePlanningExpenseCounts({
      baseExpenseCount: 5,
      baseUnpaidCount: 2,
      knownCardDueCount: 1,
      walletLoanDueCount: 1,
      payrollDeductionCount: 1,
    });

    expect(result.planningExpenseCount).toBe(8);
    expect(result.planningUnpaidExpenseCount).toBe(5);
  });
});
