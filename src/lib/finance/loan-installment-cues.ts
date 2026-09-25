import type { LoanPaymentListItem } from '@/types/loans';

type CuePayment = Pick<LoanPaymentListItem, 'status' | 'dueDate' | 'amount' | 'sequence'> & {
  loanId?: number;
};

export type InstallmentCue = {
  amount: number;
  date: string;
  dateEnd: string;
  isRange: boolean;
  count: number;
};

export type InstallmentCueSummary = {
  overdue: InstallmentCue | null;
  next: InstallmentCue | null;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const byDueDate = (a: CuePayment, b: CuePayment) =>
  a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence;

const toCue = (rows: CuePayment[]): InstallmentCue | null => {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(byDueDate);
  const date = sorted[0]!.dueDate;
  const dateEnd = sorted[sorted.length - 1]!.dueDate;
  return {
    amount: roundMoney(sorted.reduce((sum, row) => sum + row.amount, 0)),
    date,
    dateEnd,
    isRange: date !== dateEnd,
    count: sorted.length,
  };
};

/** Past-due unpaid installments vs the next unpaid installment that is still due. */
export const partitionScheduledInstallments = <T extends CuePayment>(
  payments: readonly T[],
  todayYmd: string,
): { overdue: T[]; upcoming: T[] } => {
  const scheduled = payments
    .filter((payment) => payment.status === 'SCHEDULED')
    .sort(byDueDate);
  return {
    overdue: scheduled.filter((payment) => payment.dueDate < todayYmd),
    upcoming: scheduled.filter((payment) => payment.dueDate >= todayYmd),
  };
};

const nextPerLoan = <T extends CuePayment>(upcoming: readonly T[]): T[] => {
  const seen = new Set<number>();
  const rows: T[] = [];
  for (const row of upcoming) {
    const loanId = row.loanId ?? 0;
    if (seen.has(loanId)) continue;
    seen.add(loanId);
    rows.push(row);
  }
  return rows;
};

/**
 * "Vencida" sums every unpaid installment before today (civil day).
 * "Próximo" is the next unpaid installment due today or later.
 * With `perLoanNext`, that is one future installment per loan.
 */
export const summarizeInstallmentCues = (
  payments: readonly CuePayment[],
  todayYmd: string,
  options?: { perLoanNext?: boolean },
): InstallmentCueSummary => {
  const { overdue, upcoming } = partitionScheduledInstallments(payments, todayYmd);
  const nextRows = options?.perLoanNext ? nextPerLoan(upcoming) : upcoming.slice(0, 1);
  return {
    overdue: toCue(overdue),
    next: toCue(nextRows),
  };
};
