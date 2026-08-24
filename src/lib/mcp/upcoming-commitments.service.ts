import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import { listInstallmentPlanPaymentsForPlannerMonth } from '@/lib/finance/credit-card-installment-plan.service';
import type { PlannerInstallmentPlanPaymentItem } from '@/lib/finance/credit-card-installment-plan.service';
import { getDuePaymentsForPlannerMonth } from '@/lib/finance/credit-card-statement.service';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { DuePaymentItem } from '@/types/catalog';

export type UpcomingCommitmentItem = {
  date: string;
  type: 'revolving' | 'msi' | 'loan';
  name: string;
  amount: number;
  is_paid: boolean;
  source_id: number;
  wallet_or_loan: string;
};

export type UpcomingCommitmentsResult = {
  year: number;
  month: number;
  items: UpcomingCommitmentItem[];
  period_total: number;
};

const cardDueKey = (walletId: number, dueDateYmd: string): string =>
  `${walletId}:${dueDateYmd}`;

const isUnpaidCardPlannerRow = (item: DuePaymentItem): boolean => {
  if (item.plannerStatus === 'pagado' || item.plannerStatus === 'sin_cargo') {
    return false;
  }
  return getEffectiveCardPaymentAmount(item) > 0;
};

const sumMsiByWalletDate = (
  planPayments: PlannerInstallmentPlanPaymentItem[],
): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const payment of planPayments) {
    const key = cardDueKey(payment.walletId, payment.dueDate);
    totals.set(key, (totals.get(key) ?? 0) + payment.amount);
  }
  return totals;
};

const leftoverRevolvingFromCardDue = (
  payment: DuePaymentItem,
  msiOnDate: number,
): number => {
  const cardAmount = getEffectiveCardPaymentAmount(payment);
  if (cardAmount <= 0) return 0;

  // Calendario / resto al corte: monto aparte de las cuotas MSI del plan.
  if (payment.obligationAmountSource === 'scheduled_calendar') {
    return cardAmount;
  }

  return Math.max(0, cardAmount - msiOnDate);
};

/**
 * Unified upcoming commitments for a planner month.
 *
 * Per card/date: sum(MSI plan cuotas in month) + leftover revolving (resto al
 * corte). Never drop MSI because a leftover revolving row exists; never stack
 * full statement due that already embeds those MSI with the same cuotas again.
 */
export async function listUpcomingCommitmentsForMonth(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
): Promise<UpcomingCommitmentsResult> {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const [cardDue, planPayments, loanPayments] = await Promise.all([
    getDuePaymentsForPlannerMonth(ownerFilter, year, month),
    listInstallmentPlanPaymentsForPlannerMonth(ownerFilter, year, month),
    listLoanPaymentsForPlannerMonth(ownerFilter, year, month),
  ]);

  const msiByWalletDate = sumMsiByWalletDate(planPayments);
  const items: UpcomingCommitmentItem[] = [];

  for (const payment of planPayments) {
    items.push({
      date: payment.dueDate,
      type: 'msi',
      name: payment.planName,
      amount: payment.amount,
      is_paid: false,
      source_id: payment.planId,
      wallet_or_loan: payment.walletName,
    });
  }

  for (const payment of [...cardDue.first, ...cardDue.second]) {
    if (!isUnpaidCardPlannerRow(payment)) continue;

    const date = payment.visibleDueDate ?? payment.statementDueDate;
    if (!date.startsWith(monthPrefix)) continue;

    const msiOnDate = msiByWalletDate.get(cardDueKey(payment.walletId, date)) ?? 0;
    const leftover = leftoverRevolvingFromCardDue(payment, msiOnDate);
    if (leftover <= 0) continue;

    items.push({
      date,
      type: 'revolving',
      name: `Pago tarjeta ${payment.walletName}`,
      amount: leftover,
      is_paid: false,
      source_id: payment.walletId,
      wallet_or_loan: payment.walletName,
    });
  }

  for (const payment of [...loanPayments.first, ...loanPayments.second]) {
    if (payment.status !== 'SCHEDULED') continue;
    items.push({
      date: payment.dueDate,
      type: 'loan',
      name: payment.loanName,
      amount: payment.amount,
      is_paid: false,
      source_id: payment.id,
      wallet_or_loan: payment.lender,
    });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  const periodTotal = items
    .filter((item) => !item.is_paid)
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    year,
    month,
    items,
    period_total: periodTotal,
  };
}
