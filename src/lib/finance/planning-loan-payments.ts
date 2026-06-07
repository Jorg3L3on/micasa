/**
 * Cuotas de préstamo programadas: deben aparecer en planificación (tabla y gráfica)
 * sin duplicar gastos ya vinculados al marcar un pago como pagado.
 */

import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { TransactionRow } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';

export const LOAN_PAYMENT_PLANNING_CATEGORY = 'Pago de préstamos';
export const LOAN_PAYMENT_PLANNING_CATEGORY_ICON = '🏦';

export const formatLoanPaymentLabel = (input: {
  loanName: string;
  lender: string;
  paymentSource: LoanDuePaymentItem['paymentSource'];
}): string => {
  const isPayroll = input.paymentSource === 'PAYROLL_DEDUCTION';
  if (isPayroll) {
    return `Deducción nómina: ${input.loanName} (${input.lender})`;
  }
  return `Pago préstamo: ${input.loanName} (${input.lender})`;
};

export const formatLoanPaymentDescription = (
  payment: LoanDuePaymentItem,
): string => {
  return formatLoanPaymentLabel({
    loanName: payment.loanName,
    lender: payment.lender,
    paymentSource: payment.paymentSource,
  });
};

export const mapLoanDuePaymentToTransactionRow = (
  payment: LoanDuePaymentItem,
): TransactionRow => {
  const isPayroll = payment.paymentSource === 'PAYROLL_DEDUCTION';
  const dueDay = Number(payment.dueDate.slice(8, 10));

  return {
    id: payment.id,
    date: payment.dueDate,
    description: formatLoanPaymentDescription(payment),
    amount: payment.amount,
    category: LOAN_PAYMENT_PLANNING_CATEGORY,
    categoryIcon: LOAN_PAYMENT_PLANNING_CATEGORY_ICON,
    paymentMethod: isPayroll
      ? payment.incomeTemplateName
        ? `Nómina: ${payment.incomeTemplateName}`
        : 'Deducción de nómina'
      : (payment.sourceWalletName ??
        payment.linkedWalletName ??
        'Billetera'),
    wallet_id: payment.sourceWalletId ?? payment.linkedWalletId,
    wallet_type: null,
    planning_row_kind: 'loan_payment',
    type: 'expense',
    is_paid: false,
    due_day: Number.isFinite(dueDay) ? dueDay : null,
  };
};

export const linkedLoanPaymentExpenseIds = (
  payments: ReadonlyArray<{ linkedExpenseId: number | null }>,
): Set<number> => {
  const ids = new Set<number>();
  for (const payment of payments) {
    if (payment.linkedExpenseId != null) {
      ids.add(payment.linkedExpenseId);
    }
  }
  return ids;
};

export async function listScheduledLoanPaymentsForPlanning(
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
  period?: 'FIRST' | 'SECOND' | null,
): Promise<LoanDuePaymentItem[]> {
  const { first, second } = await listLoanPaymentsForPlannerMonth(
    ownerFilter,
    year,
    month,
  );

  const periodPayments =
    period === 'FIRST'
      ? first
      : period === 'SECOND'
        ? second
        : [...first, ...second];

  return periodPayments.filter((payment) => payment.status === 'SCHEDULED');
}
