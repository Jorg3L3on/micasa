import { parseYmdAsUtcDate, formatDateYmd, getLoanEndDate } from '@/lib/finance/loan-schedule';
import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

/**
 * Pure figures for the Préstamos list (summary strip and lender cards).
 * Everything comes from `LoanListItem`; dates are civil YYYY-MM-DD strings.
 */

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const DUE_SOON_DAYS = 7;

export const daysBetweenYmd = (fromYmd: string, toYmd: string): number => {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  if ([fy, fm, fd, ty, tm, td].some((n) => !Number.isFinite(n))) return 0;
  return Math.round(
    (Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000,
  );
};

type PaymentWithLoan = LoanPaymentListItem & { loan: LoanListItem };

const unpaidPayments = (loan: LoanListItem): LoanPaymentListItem[] => {
  const rows = loan.payments;
  if (rows && rows.length > 0) {
    return rows.filter((payment) => payment.status === 'SCHEDULED');
  }
  // Without the schedule, fall back to the two cues the list API always sends.
  const fallback: LoanPaymentListItem[] = [];
  if (loan.overduePayment) fallback.push(loan.overduePayment);
  if (loan.nextPayment) fallback.push(loan.nextPayment);
  return fallback;
};

/** Unpaid installments due before today, across these loans (active only). */
const overduePayments = (loans: LoanListItem[], todayYmd: string): PaymentWithLoan[] =>
  loans
    .filter((loan) => loan.status === 'ACTIVE')
    .flatMap((loan) =>
      unpaidPayments(loan)
        .filter((payment) => payment.dueDate < todayYmd)
        .map((payment) => ({ ...payment, loan })),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence);

/** Next unpaid installment due today or later, one per loan, earliest first. */
const upcomingPayments = (loans: LoanListItem[], todayYmd: string): PaymentWithLoan[] =>
  loans
    .filter((loan) => loan.status === 'ACTIVE')
    .flatMap((loan) => {
      const next = unpaidPayments(loan)
        .filter((payment) => payment.dueDate >= todayYmd)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence)[0];
      return next ? [{ ...next, loan }] : [];
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence);

export type OverdueCue = {
  amount: number;
  count: number;
  firstDate: string;
  lastDate: string;
};

export type NextCue = {
  /** Every installment due on the earliest upcoming date. */
  amount: number;
  date: string;
  daysLeft: number;
  /** Payroll loans say "nómina"; wallet loans name the wallet. */
  source: string | null;
  sequence: number;
  loanId: number;
};

const toOverdueCue = (rows: PaymentWithLoan[]): OverdueCue | null => {
  if (rows.length === 0) return null;
  return {
    amount: roundMoney(rows.reduce((sum, row) => sum + row.amount, 0)),
    count: rows.length,
    firstDate: rows[0]!.dueDate,
    lastDate: rows[rows.length - 1]!.dueDate,
  };
};

const shortSource = (loan: LoanListItem): string | null =>
  loan.paymentSource === 'PAYROLL_DEDUCTION'
    ? 'nómina'
    : loan.sourceWalletName ?? null;

const toNextCue = (rows: PaymentWithLoan[], todayYmd: string): NextCue | null => {
  const first = rows[0];
  if (!first) return null;
  const sameDay = rows.filter((row) => row.dueDate === first.dueDate);
  const sources = new Set(sameDay.map((row) => shortSource(row.loan)));
  return {
    amount: roundMoney(sameDay.reduce((sum, row) => sum + row.amount, 0)),
    date: first.dueDate,
    daysLeft: daysBetweenYmd(todayYmd, first.dueDate),
    source: sources.size === 1 ? shortSource(first.loan) : null,
    sequence: first.sequence,
    loanId: first.loanId,
  };
};

/** YYYY-MM-DD of the last installment: the schedule when loaded, else computed. */
export const getLoanEndYmd = (loan: LoanListItem): string | null => {
  const payments = (loan.payments ?? []).filter(
    (payment) => payment.status !== 'CANCELLED',
  );
  if (payments.length > 0) {
    return payments.reduce(
      (latest, payment) => (payment.dueDate > latest ? payment.dueDate : latest),
      payments[0]!.dueDate,
    );
  }
  if (!loan.startDate) return null;
  const end = getLoanEndDate(
    parseYmdAsUtcDate(loan.startDate.slice(0, 10)),
    loan.paymentCount,
    loan.frequency,
  );
  return end ? formatDateYmd(end) : null;
};

const maxYmd = (values: Array<string | null>): string | null =>
  values.reduce<string | null>(
    (latest, value) => (value && (!latest || value > latest) ? value : latest),
    null,
  );

/** Installments that should be covered by today (non-cancelled, due before today). */
const expectedPaidCount = (loan: LoanListItem, todayYmd: string): number | null => {
  if (!loan.payments || loan.payments.length === 0) return null;
  return loan.payments.filter(
    (payment) => payment.status !== 'CANCELLED' && payment.dueDate < todayYmd,
  ).length;
};

export type LoanHealth = 'overdue' | 'soon' | 'ok' | 'paused' | 'paid' | 'cancelled';

const HEALTH_RANK: Record<LoanHealth, number> = {
  overdue: 0,
  soon: 1,
  ok: 2,
  paused: 3,
  paid: 4,
  cancelled: 5,
};

export const getLoanHealth = (loan: LoanListItem, todayYmd: string): LoanHealth => {
  if (loan.status === 'PAID_OFF') return 'paid';
  if (loan.status === 'CANCELLED') return 'cancelled';
  if (loan.status === 'PAUSED') return 'paused';
  if (overduePayments([loan], todayYmd).length > 0) return 'overdue';
  const next = toNextCue(upcomingPayments([loan], todayYmd), todayYmd);
  if (next && next.daysLeft <= DUE_SOON_DAYS) return 'soon';
  return 'ok';
};

/** Worst state wins: vencido > ≤ 7 días > al día > pausado > liquidado. */
export const getWorstHealth = (
  loans: LoanListItem[],
  todayYmd: string,
): LoanHealth | null =>
  loans.reduce<LoanHealth | null>((worst, loan) => {
    const health = getLoanHealth(loan, todayYmd);
    if (!worst) return health;
    return HEALTH_RANK[health] < HEALTH_RANK[worst] ? health : worst;
  }, null);

export type LoanGroupSummary = {
  /** Remaining on active loans. */
  pending: number;
  /** Payable total on active loans. */
  total: number;
  overdue: OverdueCue | null;
  next: NextCue | null;
  paidInstallments: number;
  totalInstallments: number;
  /** Where the bar should be if nothing were late (0–100), when known. */
  expectedPct: number | null;
  endYmd: string | null;
  activeCount: number;
  health: LoanHealth | null;
};

export const summarizeLoanGroup = (
  loans: LoanListItem[],
  todayYmd: string,
): LoanGroupSummary => {
  const active = loans.filter((loan) => loan.status === 'ACTIVE');
  const paidInstallments = active.reduce((sum, loan) => sum + loan.paidPayments, 0);
  const totalInstallments = active.reduce((sum, loan) => sum + loan.paymentCount, 0);
  const expectedCounts = active.map((loan) => expectedPaidCount(loan, todayYmd));
  const expected = expectedCounts.every((count) => count != null)
    ? expectedCounts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
    : null;
  return {
    pending: roundMoney(active.reduce((sum, loan) => sum + loan.remainingAmount, 0)),
    total: roundMoney(active.reduce((sum, loan) => sum + loan.totalPayable, 0)),
    overdue: toOverdueCue(overduePayments(active, todayYmd)),
    next: toNextCue(upcomingPayments(active, todayYmd), todayYmd),
    paidInstallments,
    totalInstallments,
    expectedPct:
      expected != null && totalInstallments > 0
        ? Math.min(100, (expected / totalInstallments) * 100)
        : null,
    endYmd: maxYmd(active.map(getLoanEndYmd)),
    activeCount: active.length,
    health: getWorstHealth(loans, todayYmd),
  };
};

export const progressPct = (paid: number, total: number): number =>
  total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;

export type LoanStatusTab = 'ACTIVE' | 'PAUSED' | 'PAID_OFF' | 'CANCELLED';

export const countLoansByStatus = (
  loans: LoanListItem[],
): Record<LoanStatusTab, number> =>
  loans.reduce(
    (counts, loan) => {
      counts[loan.status] += 1;
      return counts;
    },
    { ACTIVE: 0, PAUSED: 0, PAID_OFF: 0, CANCELLED: 0 } as Record<LoanStatusTab, number>,
  );
