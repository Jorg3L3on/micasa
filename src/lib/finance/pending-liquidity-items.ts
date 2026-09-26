import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import { toDisplayAmount } from '@/lib/utils';
import type { DuePaymentItem, TransactionRow } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';

export type PendingLiquidityLineItem = {
  id: string;
  name: string;
  amount: number;
};

const isCashFlowPendingExpense = (row: TransactionRow): boolean => {
  if (row.type === 'income' || row.is_paid) return false;
  if (row.planning_row_kind === 'card_payment') return false;
  if (row.planning_row_kind === 'loan_payment') return false;
  if (isCreditOrStoreCardWalletType(row.wallet_type)) return false;
  return toDisplayAmount(row.amount) > 0;
};

/**
 * Names that make up “Menos pendiente de la quincena (no pagado)”:
 * unpaid cash/debit gastos, pending card cortes, and pending wallet loan cuotas.
 */
export const getPendingLiquidityLineItems = ({
  transactions = [],
  cardDueItems = [],
  loanDueItems = [],
}: {
  transactions?: TransactionRow[];
  cardDueItems?: DuePaymentItem[];
  loanDueItems?: LoanDuePaymentItem[];
}): PendingLiquidityLineItem[] => {
  const items: PendingLiquidityLineItem[] = [];

  for (const row of transactions) {
    if (!isCashFlowPendingExpense(row)) continue;
    items.push({
      id: `expense-${row.id}`,
      name: row.description,
      amount: toDisplayAmount(row.amount),
    });
  }

  for (const card of cardDueItems) {
    const amount = getEffectiveCardPaymentAmount(card);
    const status = card.plannerStatus;
    if (amount <= 0) continue;
    if (status === 'pagado' || status === 'sin_cargo') continue;
    items.push({
      id: `card-${card.walletId}`,
      name: `Pago tarjeta: ${card.walletName}`,
      amount,
    });
  }

  for (const loan of loanDueItems) {
    if (loan.paymentSource !== 'WALLET' || loan.status !== 'SCHEDULED') continue;
    if (loan.amount <= 0) continue;
    items.push({
      id: `loan-${loan.id}`,
      name: `Pago préstamo: ${loan.loanName} (${loan.lender})`,
      amount: loan.amount,
    });
  }

  return items;
};
