import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { toDisplayAmount } from '@/lib/utils';
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

const isCardChargeFooterRow = (
  row: Pick<TransactionRow, 'type' | 'wallet_type'>,
): boolean => {
  if (row.type === 'income') return false;
  return isCreditOrStoreCardWalletType(row.wallet_type);
};

/**
 * "Total efectivo/débito" in the Gastos footer.
 * Card charges stay out. Card payments and loan payments stay in.
 */
export const sumCashFlowFooterTotal = (
  rows: readonly Pick<TransactionRow, 'type' | 'wallet_type' | 'amount'>[],
): number =>
  rows.reduce((sum, row) => {
    if (isCardChargeFooterRow(row)) return sum;
    return sum + toDisplayAmount(row.amount);
  }, 0);

/**
 * List + chip for the Gastos tab.
 * `rows` is the visible list. `cashFlowRows` is the unfiltered set for the footer.
 * Pagado, Pendiente, Presupuesto, and Liquidez are returned as given.
 */
export const presentFortnightExpenseTab = <T extends FortnightExpenseTabRow>(input: {
  rows: readonly T[];
  totals: FortnightPlannerMoneyTotals;
}): {
  rows: T[];
  cashFlowRows: readonly T[];
  unpaidCount: number;
  totals: FortnightPlannerMoneyTotals;
} => ({
  rows: filterFortnightExpenseTabRows(input.rows),
  cashFlowRows: input.rows,
  unpaidCount: countUnpaidFortnightExpenses(input.rows),
  totals: input.totals,
});
