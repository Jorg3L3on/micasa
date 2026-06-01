/**
 * Applies planner card payment totals to expense summaries without double-counting:
 * orphan payments increase both expense and paid; statement due increases expense only
 * (remaining unpaid obligation, already net of payments applied to the statement).
 */

export type PlanningOrphanPayments = {
  total: number;
  count: number;
};

export type PlanningCardStatementDue = {
  total: number;
  cardCount: number;
};

export type PlanningExpenseTotals = {
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
};

export const applyOrphanCardPaymentsToExpenseTotals = (
  totals: PlanningExpenseTotals,
  orphan: PlanningOrphanPayments | null,
): PlanningExpenseTotals => {
  if (!orphan || orphan.count <= 0) {
    return {
      ...totals,
      totalUnpaid: totals.totalExpense - totals.totalPaid,
    };
  }
  const totalExpense = totals.totalExpense + orphan.total;
  const totalPaid = totals.totalPaid + orphan.total;
  return {
    totalExpense,
    totalPaid,
    totalUnpaid: totalExpense - totalPaid,
  };
};

export const applyCardStatementDueToExpenseTotals = (
  totals: PlanningExpenseTotals,
  cardDue: PlanningCardStatementDue | null,
): PlanningExpenseTotals => {
  if (!cardDue || cardDue.total <= 0) {
    return {
      ...totals,
      totalUnpaid: totals.totalExpense - totals.totalPaid,
    };
  }
  const totalExpense = totals.totalExpense + cardDue.total;
  return {
    totalExpense,
    totalPaid: totals.totalPaid,
    totalUnpaid: totalExpense - totals.totalPaid,
  };
};

export const mergePlanningCardTotalsIntoExpenseSummary = (
  base: PlanningExpenseTotals,
  orphan: PlanningOrphanPayments | null,
  cardDue: PlanningCardStatementDue | null,
): PlanningExpenseTotals => {
  const withOrphan = applyOrphanCardPaymentsToExpenseTotals(base, orphan);
  return applyCardStatementDueToExpenseTotals(withOrphan, cardDue);
};
