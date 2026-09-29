import type { TransactionRow } from '@/types/catalog';

/**
 * Gastos-tab view filter.
 * Tarjetas and Préstamos already own these rows (`card_payment` / `loan_payment`).
 * The kind is the same origin those tabs use — not the description text.
 */
export type FortnightExpenseTabRow = Pick<
  TransactionRow,
  'planning_row_kind' | 'type' | 'is_paid'
>;

export type FortnightPlannerMoneyTotals = {
  pagado: number;
  pendiente: number;
  presupuesto: number;
  liquidez: number;
};

export const isFortnightCardOrLoanMovement = (
  row: Pick<TransactionRow, 'planning_row_kind'>,
): boolean =>
  row.planning_row_kind === 'card_payment' ||
  row.planning_row_kind === 'loan_payment';

export const filterFortnightExpenseTabRows = <T extends FortnightExpenseTabRow>(
  rows: readonly T[],
): T[] => rows.filter((row) => !isFortnightCardOrLoanMovement(row));

/** Unpaid expenses only. Card payments, loan payments, and income do not count. */
export const countUnpaidFortnightExpenses = (
  rows: readonly FortnightExpenseTabRow[],
): number =>
  filterFortnightExpenseTabRows(rows).filter(
    (row) => row.type !== 'income' && !row.is_paid,
  ).length;

/**
 * List + chip for the Gastos tab. Totals are returned as given:
 * Pagado, Pendiente, Presupuesto, and Liquidez are not derived from the visible rows.
 */
export const presentFortnightExpenseTab = <T extends FortnightExpenseTabRow>(input: {
  rows: readonly T[];
  totals: FortnightPlannerMoneyTotals;
}): {
  rows: T[];
  unpaidCount: number;
  totals: FortnightPlannerMoneyTotals;
} => ({
  rows: filterFortnightExpenseTabRows(input.rows),
  unpaidCount: countUnpaidFortnightExpenses(input.rows),
  totals: input.totals,
});
