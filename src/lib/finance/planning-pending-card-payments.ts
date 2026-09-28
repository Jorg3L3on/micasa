import { panelSnapshotFromDueItem } from '@/lib/finance/card-period-surfaces';
import type { DuePaymentItem, TransactionRow } from '@/types/catalog';

/**
 * Planned card statement dues that already count in the fortnight pending total.
 * Gaps without a known cash figure stay out, so the list matches the counter.
 */
export const mapPendingCardDueToTransactionRow = (
  item: DuePaymentItem,
): TransactionRow | null => {
  const snapshot = panelSnapshotFromDueItem(item);
  const amount = snapshot.knownCashAmount ?? 0;
  if (!snapshot.countsInKnownTotal || amount <= 0) return null;

  const dueDate = item.visibleDueDate ?? item.statementDueDate;
  const dueDay = Number(dueDate.slice(8, 10));

  return {
    id: -item.walletId,
    date: dueDate,
    description: `Pago tarjeta: ${item.walletName}`,
    amount,
    category: 'Pago a tarjeta',
    categoryIcon: 'CREDIT_CARD',
    paymentMethod: item.walletName,
    wallet_id: null,
    wallet_type: null,
    planning_row_kind: 'card_payment',
    type: 'expense',
    is_paid: false,
    due_day: Number.isFinite(dueDay) ? dueDay : null,
  };
};

export const mapPendingCardDuesToTransactionRows = (
  items: readonly DuePaymentItem[],
): TransactionRow[] =>
  items.flatMap((item) => {
    const row = mapPendingCardDueToTransactionRow(item);
    return row ? [row] : [];
  });

/** Known pending card rows that the summary already adds to the unpaid total. */
export const countKnownPendingCardDues = (
  items: readonly DuePaymentItem[],
): number => mapPendingCardDuesToTransactionRows(items).length;
