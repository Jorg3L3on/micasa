import { formatCalendarDate } from '@/lib/calendar-dates';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import {
  asOfYmdForMonthKey,
  compareMonthKeys,
} from '@/lib/finance/liquidity-chart-range';
import { balanceAtDate } from '@/lib/finance/wallet-balance-evolution';
import {
  type MonthDebtItem,
  monthDebtItemsTotal,
  monthDebtPaymentsTotal,
  pastLoanDebtSubtitle,
} from '@/lib/finance/liquidity-month-debt-items';
import type { WalletMovement } from '@/types/wallet-movements';

export type LoanPaymentSnapshot = {
  loan_id: number;
  loan_name: string;
  lender: string;
  payment_source: string;
  amount: number;
  due_date: Date;
  paid_at: Date | null;
  status: string;
};

export type DebtWalletSnapshot = {
  id: number;
  name: string;
  type: string;
  amount: number;
};

export type MonthOutstandingSnapshot = {
  outstanding_debt_total: number;
  debt_items: MonthDebtItem[];
  payments_due_total: number;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const calendarMonthKeyFromDate = (date: Date): string =>
  formatCalendarDate(date).slice(0, 7);

export const loanRemainingAtAsOf = (
  payments: readonly LoanPaymentSnapshot[],
  asOfYmd: string,
): number =>
  roundMoney(
    payments.reduce((sum, payment) => {
      if (payment.status === 'SKIPPED' || payment.status === 'CANCELLED') return sum;
      if (
        payment.status === 'PAID' &&
        payment.paid_at &&
        formatCalendarDate(payment.paid_at) <= asOfYmd
      ) {
        return sum;
      }
      return sum + payment.amount;
    }, 0),
  );

export const cardDebtAtAsOf = (
  wallets: readonly DebtWalletSnapshot[],
  movementsByWalletId: ReadonlyMap<number, readonly WalletMovement[]>,
  asOfYmd: string,
): number =>
  roundMoney(
    wallets.reduce((sum, wallet) => {
      if (!isCreditOrStoreCardWalletType(wallet.type)) return sum;
      const movements = movementsByWalletId.get(wallet.id) ?? [];
      const balance = balanceAtDate(Number(wallet.amount), movements, asOfYmd, true);
      return sum + Math.max(0, balance);
    }, 0),
  );

export const buildLoanDebtItemsAtAsOf = (
  payments: readonly LoanPaymentSnapshot[],
  asOfYmd: string,
): MonthDebtItem[] => {
  const byLoan = new Map<
    number,
    { title: string; subtitle: string; remaining: number }
  >();

  for (const payment of payments) {
    if (payment.status === 'SKIPPED' || payment.status === 'CANCELLED') continue;
    if (
      payment.status === 'PAID' &&
      payment.paid_at &&
      formatCalendarDate(payment.paid_at) <= asOfYmd
    ) {
      continue;
    }
    const previous = byLoan.get(payment.loan_id);
    if (previous) {
      previous.remaining = roundMoney(previous.remaining + payment.amount);
      continue;
    }
    byLoan.set(payment.loan_id, {
      title: payment.loan_name,
      subtitle: pastLoanDebtSubtitle(payment.payment_source, payment.lender),
      remaining: payment.amount,
    });
  }

  return [...byLoan.entries()]
    .filter(([, row]) => row.remaining > 0)
    .map(([loanId, row]) => ({
      id: `loan-${loanId}-${asOfYmd.slice(0, 7)}`,
      kind: 'loan' as const,
      title: row.title,
      subtitle: row.subtitle,
      amount: row.remaining,
    }))
    .sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title, 'es'));
};

export const buildCardDebtItemsAtAsOf = (
  wallets: readonly DebtWalletSnapshot[],
  movementsByWalletId: ReadonlyMap<number, readonly WalletMovement[]>,
  asOfYmd: string,
): MonthDebtItem[] =>
  wallets
    .filter((wallet) => isCreditOrStoreCardWalletType(wallet.type))
    .map((wallet) => {
      const movements = movementsByWalletId.get(wallet.id) ?? [];
      const balance = Math.max(
        0,
        balanceAtDate(Number(wallet.amount), movements, asOfYmd, true),
      );
      return {
        id: `card-${wallet.id}-${asOfYmd.slice(0, 7)}`,
        kind: 'card' as const,
        title: wallet.name,
        subtitle: 'Adeudo de tarjeta',
        amount: roundMoney(balance),
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.title.localeCompare(b.title, 'es'));

export const buildMonthOutstandingSnapshot = (input: {
  monthKey: string;
  todayYmd: string;
  wallets: readonly DebtWalletSnapshot[];
  movementsByWalletId: ReadonlyMap<number, readonly WalletMovement[]>;
  loanPayments: readonly LoanPaymentSnapshot[];
  cardPaymentsByMonth: ReadonlyMap<string, ReadonlyMap<number, number>>;
  loanPaymentsByMonth: ReadonlyMap<string, ReadonlyMap<number, number>>;
}): MonthOutstandingSnapshot => {
  const asOfYmd = asOfYmdForMonthKey(input.monthKey, input.todayYmd);
  const cardItems = buildCardDebtItemsAtAsOf(
    input.wallets,
    input.movementsByWalletId,
    asOfYmd,
  );
  const loanItems = buildLoanDebtItemsAtAsOf(input.loanPayments, asOfYmd);
  const debt_items = [...cardItems, ...loanItems].sort(
    (a, b) => b.amount - a.amount || a.title.localeCompare(b.title, 'es'),
  );

  const cardPayments = input.cardPaymentsByMonth.get(input.monthKey);
  const loanPayments = input.loanPaymentsByMonth.get(input.monthKey);
  let payments_due_total = 0;
  if (cardPayments) {
    for (const amount of cardPayments.values()) payments_due_total += amount;
  }
  if (loanPayments) {
    for (const amount of loanPayments.values()) payments_due_total += amount;
  }
  payments_due_total = roundMoney(payments_due_total);

  for (const item of debt_items) {
    if (item.kind === 'card') {
      const walletId = Number(item.id.split('-')[1]);
      item.payment_amount = roundMoney(cardPayments?.get(walletId) ?? 0);
    } else if (item.kind === 'loan') {
      const loanId = Number(item.id.split('-')[1]);
      item.payment_amount = roundMoney(loanPayments?.get(loanId) ?? 0);
    }
  }

  return {
    outstanding_debt_total: monthDebtItemsTotal(debt_items),
    debt_items,
    payments_due_total,
  };
};

/** Past + current months only (future uses projection debt_items). */
export const shouldUseHistoricalDebtSnapshot = (
  monthKey: string,
  todayYmd: string,
): boolean => compareMonthKeys(monthKey, todayYmd.slice(0, 7)) <= 0;

export const attachPaymentAmountsFromTotals = (
  debtItems: MonthDebtItem[],
  paymentsTotal: number,
): void => {
  if (paymentsTotal <= 0) return;
  const current = monthDebtPaymentsTotal(debtItems);
  if (current > 0) return;
  const top = debtItems[0];
  if (top) top.payment_amount = paymentsTotal;
};
