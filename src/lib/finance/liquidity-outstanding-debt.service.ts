import {
  endOfCalendarDay,
  formatCalendarDate,
  parseCalendarDate,
  startOfCalendarDay,
} from '@/lib/calendar-dates';
import { LoanPaymentStatus, PaymentMethodType } from '@/generated/prisma/client';
import { listWalletMovements } from '@/lib/finance/wallet-movements';
import {
  buildMonthKeyRange,
  compareMonthKeys,
  endOfMonthYmdFromMonthKey,
} from '@/lib/finance/liquidity-chart-range';
import {
  buildMonthOutstandingSnapshot,
  calendarMonthKeyFromDate,
  type DebtWalletSnapshot,
  type LoanPaymentSnapshot,
  type MonthOutstandingSnapshot,
  shouldUseHistoricalDebtSnapshot,
} from '@/lib/finance/liquidity-outstanding-debt';
import { pastDebtDateForLoanPayment } from '@/lib/finance/monthly-chart-debt';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import type { WalletMovement } from '@/types/wallet-movements';

export const loadHistoricalOutstandingByMonth = async (
  ownerFilter: OwnerFilter,
  monthKeys: readonly string[],
  todayYmd: string,
): Promise<Map<string, MonthOutstandingSnapshot>> => {
  const historicalKeys = monthKeys.filter((key) =>
    shouldUseHistoricalDebtSnapshot(key, todayYmd),
  );
  if (historicalKeys.length === 0) return new Map();

  const firstMonth = historicalKeys[0]!;
  const rangeFrom = startOfCalendarDay(`${firstMonth}-01`);
  const rangeTo = endOfCalendarDay(todayYmd);

  const [debtWallets, cardPayments, loanPaymentRows] = await Promise.all([
    prisma.wallet.findMany({
      where: {
        ...ownerFilter,
        active: true,
        type: {
          in: [PaymentMethodType.CREDIT_CARD, PaymentMethodType.DEPARTMENT_STORE_CARD],
        },
      },
      select: { id: true, name: true, type: true, amount: true },
      orderBy: { name: 'asc' },
    }),
    prisma.creditCardPayment.findMany({
      where: {
        ...ownerFilter,
        paid_at: { gte: rangeFrom, lte: rangeTo },
      },
      select: {
        amount: true,
        paid_at: true,
        credit_card_wallet_id: true,
      },
    }),
    prisma.loanPayment.findMany({
      where: {
        loan: ownerFilter,
        OR: [
          {
            status: LoanPaymentStatus.PAID,
            paid_at: { gte: rangeFrom, lte: rangeTo },
          },
          {
            status: { notIn: [LoanPaymentStatus.SKIPPED, LoanPaymentStatus.CANCELLED] },
            due_date: { gte: rangeFrom, lte: rangeTo },
          },
        ],
      },
      select: {
        amount: true,
        paid_at: true,
        due_date: true,
        status: true,
        loan: {
          select: {
            id: true,
            name: true,
            lender: true,
            payment_source: true,
          },
        },
      },
    }),
  ]);

  const loanPaymentsForRemaining = await prisma.loanPayment.findMany({
    where: {
      loan: { ...ownerFilter, status: { in: ['ACTIVE', 'PAID_OFF'] } },
      status: { notIn: [LoanPaymentStatus.SKIPPED, LoanPaymentStatus.CANCELLED] },
    },
    select: {
      amount: true,
      paid_at: true,
      due_date: true,
      status: true,
      loan: {
        select: {
          id: true,
          name: true,
          lender: true,
          payment_source: true,
        },
      },
    },
  });

  const wallets: DebtWalletSnapshot[] = debtWallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    amount: Number(wallet.amount),
  }));

  const movementsByWalletId = new Map<number, WalletMovement[]>();
  await Promise.all(
    wallets.map(async (wallet) => {
      const movements = await listWalletMovements(
        wallet.id,
        ownerFilter,
        formatCalendarDate(rangeFrom),
        todayYmd,
      );
      movementsByWalletId.set(wallet.id, movements);
    }),
  );

  const loanPayments: LoanPaymentSnapshot[] = loanPaymentsForRemaining.map((row) => ({
    loan_id: row.loan.id,
    loan_name: row.loan.name,
    lender: row.loan.lender,
    payment_source: row.loan.payment_source,
    amount: Number(row.amount),
    due_date: row.due_date,
    paid_at: row.paid_at,
    status: row.status,
  }));

  const cardPaymentsByMonth = new Map<string, Map<number, number>>();
  for (const payment of cardPayments) {
    const monthKey = calendarMonthKeyFromDate(payment.paid_at);
    const walletMap = cardPaymentsByMonth.get(monthKey) ?? new Map<number, number>();
    walletMap.set(
      payment.credit_card_wallet_id,
      (walletMap.get(payment.credit_card_wallet_id) ?? 0) + Number(payment.amount),
    );
    cardPaymentsByMonth.set(monthKey, walletMap);
  }

  const loanPaymentsByMonth = new Map<string, Map<number, number>>();
  for (const payment of loanPaymentRows) {
    const when = pastDebtDateForLoanPayment({
      status: payment.status,
      paid_at: payment.paid_at,
      due_date: payment.due_date,
      payment_source: payment.loan.payment_source,
    });
    if (!when) continue;
    const monthKey = calendarMonthKeyFromDate(when);
    const loanMap = loanPaymentsByMonth.get(monthKey) ?? new Map<number, number>();
    loanMap.set(payment.loan.id, (loanMap.get(payment.loan.id) ?? 0) + Number(payment.amount));
    loanPaymentsByMonth.set(monthKey, loanMap);
  }

  const result = new Map<string, MonthOutstandingSnapshot>();
  for (const monthKey of historicalKeys) {
    result.set(
      monthKey,
      buildMonthOutstandingSnapshot({
        monthKey,
        todayYmd,
        wallets,
        movementsByWalletId,
        loanPayments,
        cardPaymentsByMonth,
        loanPaymentsByMonth,
      }),
    );
  }

  return result;
};

export { buildMonthKeyRange, compareMonthKeys, endOfMonthYmdFromMonthKey };
