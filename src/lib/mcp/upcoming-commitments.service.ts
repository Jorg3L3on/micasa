import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import { listInstallmentPlanPaymentsForPlannerMonth } from '@/lib/finance/credit-card-installment-plan.service';
import { getDuePaymentsForPlannerMonth } from '@/lib/finance/credit-card-statement.service';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

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

const isUnpaidCardPlannerRow = (item: {
  plannerStatus: string;
  effectiveAmount?: number;
  remainingPlannerAmount?: number;
  nextDuePayment: number;
  plannedPayment?: number | null;
  paymentsAppliedToFortnight?: number;
  paymentsAppliedToStatement?: number;
}): boolean => {
  if (item.plannerStatus === 'pagado' || item.plannerStatus === 'sin_cargo') {
    return false;
  }
  return getEffectiveCardPaymentAmount(item) > 0;
};

/**
 * Unified upcoming commitments for a planner month — same dedup rule as Panel
 * financiero / Liquidez: one card obligation per wallet per due date (MSI +
 * revolving combined via getDuePaymentsForPlannerMonth); standalone MSI plan
 * rows only when not already covered by that card due line.
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

  const items: UpcomingCommitmentItem[] = [];
  const coveredCardDue = new Set<string>();

  for (const payment of [...cardDue.first, ...cardDue.second]) {
    if (!isUnpaidCardPlannerRow(payment)) continue;

    const date = payment.visibleDueDate ?? payment.statementDueDate;
    if (!date.startsWith(monthPrefix)) continue;

    const amount = getEffectiveCardPaymentAmount(payment);
    coveredCardDue.add(cardDueKey(payment.walletId, date));

    items.push({
      date,
      type: 'revolving',
      name: `Pago tarjeta ${payment.walletName}`,
      amount,
      is_paid: false,
      source_id: payment.walletId,
      wallet_or_loan: payment.walletName,
    });
  }

  for (const payment of planPayments) {
    if (coveredCardDue.has(cardDueKey(payment.walletId, payment.dueDate))) {
      continue;
    }
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
