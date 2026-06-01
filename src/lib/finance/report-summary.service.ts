import type { Prisma } from '@/generated/prisma/client';
import { PaymentMethodType } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  whereCreditOrStoreCardWalletOnly,
  wherePlanningCashFlowExpenses,
} from '@/lib/finance/expense-planning-scope';
import {
  aggregateOrphanCreditCardPaymentsForPlanning,
  buildFortnightWhereForReport,
  unionPaidAtRangeFromFortnights,
} from '@/lib/finance/planning-credit-card-payments';
import { sumPlannerCardDueForFortnight } from '@/lib/finance/credit-card-statement.service';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import {
  buildExpenseWhereForFortnightScope,
  parseFortnightPeriod,
} from '@/lib/finance/report-helpers';

export type ReportSummaryResult = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  fundingWalletBalanceTotal: number;
  fundingNetVsPendingExpense: number;
  fundingWalletBreakdown: Array<{
    id: number;
    name: string;
    amount: number;
    type: PaymentMethodType;
  }>;
  userIncome: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems: Array<{
    fortnightId: number;
    id: number;
    amount: number;
    source: string | null;
    userName: string | null;
    templateName: string | null;
  }>;
  planningExpenseCount?: number;
  planningPaidExpenseCount?: number;
  planningUnpaidExpenseCount?: number;
  cardCharges?: {
    total: number;
    paid: number;
    unpaid: number;
    expenseCount: number;
  } | null;
  planningOrphanCardPayments?: { total: number; count: number } | null;
  planningCardStatementDue?: { total: number; cardCount: number } | null;
};

export type GetReportSummaryParams = {
  ownerFilter: OwnerFilter;
  month?: string | null;
  year?: string | null;
  period?: string | null;
  excludeCreditInstallment: boolean;
};

export const getReportSummary = async (
  params: GetReportSummaryParams,
): Promise<ReportSummaryResult> => {
  const { ownerFilter, month, year, period, excludeCreditInstallment } = params;

  const baseWhere = await buildExpenseWhereForFortnightScope(
    ownerFilter,
    month,
    year,
    period,
  );
  const where = excludeCreditInstallment
    ? { AND: [baseWhere, wherePlanningCashFlowExpenses()] }
    : baseWhere;

  const [expenses, cardExpenses] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: {
        amount: true,
        is_paid: true,
      },
    }),
    excludeCreditInstallment
      ? prisma.expense.findMany({
          where: {
            AND: [baseWhere, whereCreditOrStoreCardWalletOnly()],
          },
          select: {
            amount: true,
            is_paid: true,
          },
        })
      : Promise.resolve([] as { amount: unknown; is_paid: boolean }[]),
  ]);

  const incomeWhere: Prisma.IncomeWhereInput = { ...ownerFilter };
  if (month || year || period) {
    const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
    const parsedPeriod = parseFortnightPeriod(period);
    if (month) fortnightWhere.month = parseInt(month, 10);
    if (year) fortnightWhere.year = parseInt(year, 10);
    if (parsedPeriod) fortnightWhere.period = parsedPeriod;

    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere,
      select: { id: true },
    });

    const fortnightIds = fortnights.map((f) => f.id);
    if (fortnightIds.length > 0) {
      incomeWhere.fortnight_id = { in: fortnightIds };
    } else {
      incomeWhere.fortnight_id = { in: [] };
    }
  }

  const income = await prisma.income.findMany({
    where: incomeWhere,
  });

  let totalExpense = expenses.reduce((sum, expense) => {
    return sum + Number(expense.amount);
  }, 0);

  let totalPaid = expenses
    .filter((e) => e.is_paid)
    .reduce((sum, expense) => {
      return sum + Number(expense.amount);
    }, 0);

  let orphanCardPaymentTotal = 0;
  let orphanCardPaymentCount = 0;
  if (excludeCreditInstallment) {
    const fnWhere = buildFortnightWhereForReport(
      ownerFilter,
      month,
      year,
      period,
    );
    if (fnWhere != null) {
      const planningFortnights = await prisma.fortnight.findMany({
        where: fnWhere as Prisma.FortnightWhereInput,
        select: { start_date: true, end_date: true },
      });
      const paidAtRange = unionPaidAtRangeFromFortnights(planningFortnights);
      const orphan = await aggregateOrphanCreditCardPaymentsForPlanning(
        ownerFilter,
        paidAtRange,
      );
      orphanCardPaymentTotal = orphan.total;
      orphanCardPaymentCount = orphan.count;
    }
  }

  let planningCardStatementDueTotal = 0;
  let planningCardStatementDueCardCount = 0;
  if (
    excludeCreditInstallment &&
    year &&
    month &&
    period &&
    (period === 'FIRST' || period === 'SECOND')
  ) {
    const due = await sumPlannerCardDueForFortnight(
      ownerFilter,
      parseInt(year, 10),
      parseInt(month, 10),
      period,
    );
    planningCardStatementDueTotal = due.total;
    planningCardStatementDueCardCount = due.cardCount;
  }

  const planningTotals = mergePlanningCardTotalsIntoExpenseSummary(
    { totalExpense, totalPaid, totalUnpaid: totalExpense - totalPaid },
    excludeCreditInstallment && orphanCardPaymentCount > 0
      ? { total: orphanCardPaymentTotal, count: orphanCardPaymentCount }
      : null,
    excludeCreditInstallment && planningCardStatementDueTotal > 0
      ? {
          total: planningCardStatementDueTotal,
          cardCount: planningCardStatementDueCardCount,
        }
      : null,
  );
  totalExpense = planningTotals.totalExpense;
  totalPaid = planningTotals.totalPaid;
  const totalUnpaid = planningTotals.totalUnpaid;

  const overrideIncome = income.find((inc) => inc.source === '__OVERRIDE__');
  const regularIncome = income.filter((inc) => inc.source !== '__OVERRIDE__');

  const totalIncome = overrideIncome
    ? Number(overrideIncome.amount)
    : regularIncome.reduce((sum, inc) => sum + Number(inc.amount), 0);

  const balance = totalIncome - totalExpense;

  const cardTotal = excludeCreditInstallment
    ? cardExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
    : 0;
  const cardPaid = excludeCreditInstallment
    ? cardExpenses
        .filter((e) => e.is_paid)
        .reduce((sum, e) => sum + Number(e.amount), 0)
    : 0;
  const cardUnpaid = excludeCreditInstallment ? cardTotal - cardPaid : 0;
  const cardExpenseCount = excludeCreditInstallment ? cardExpenses.length : 0;

  let planningExpenseCount = excludeCreditInstallment ? expenses.length : undefined;
  let planningPaidExpenseCount = excludeCreditInstallment
    ? expenses.filter((e) => e.is_paid).length
    : undefined;
  const planningUnpaidExpenseCount = excludeCreditInstallment
    ? expenses.filter((e) => !e.is_paid).length
    : undefined;

  if (excludeCreditInstallment && orphanCardPaymentCount > 0) {
    planningExpenseCount = (planningExpenseCount ?? 0) + orphanCardPaymentCount;
    planningPaidExpenseCount =
      (planningPaidExpenseCount ?? 0) + orphanCardPaymentCount;
  }

  let userIncomeData: ReportSummaryResult['userIncome'] = [];
  const incomeItems: ReportSummaryResult['incomeItems'] = [];

  if (month || year || period) {
    const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
    const parsedPeriod = parseFortnightPeriod(period);
    if (month) fortnightWhere.month = parseInt(month, 10);
    if (year) fortnightWhere.year = parseInt(year, 10);
    if (parsedPeriod) fortnightWhere.period = parsedPeriod;

    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere,
      select: { id: true },
    });

    const fortnightIds = fortnights.map((f) => f.id);

    if (fortnightIds.length > 0) {
      const incomes = await prisma.income.findMany({
        where: {
          ...ownerFilter,
          fortnight_id: { in: fortnightIds },
          source: { not: '__OVERRIDE__' },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const incomesForItems = await prisma.income.findMany({
        where: {
          ...ownerFilter,
          fortnight_id: { in: fortnightIds },
        },
        include: {
          user: { select: { name: true } },
          income_template: { select: { name: true } },
        },
      });
      incomesForItems.forEach((inc) => {
        incomeItems.push({
          fortnightId: inc.fortnight_id,
          id: inc.id,
          amount: Number(inc.amount),
          source: inc.source,
          userName: inc.user?.name ?? null,
          templateName: inc.income_template?.name ?? null,
        });
      });

      const incomeByFortnight: Record<number, Record<number, number>> = {};

      incomes.forEach((inc) => {
        const fortnightId = inc.fortnight_id;
        const userId = inc.user_id;
        if (userId) {
          const amount = Number(inc.amount);

          if (!incomeByFortnight[fortnightId]) {
            incomeByFortnight[fortnightId] = {};
          }
          if (!incomeByFortnight[fortnightId][userId]) {
            incomeByFortnight[fortnightId][userId] = 0;
          }
          incomeByFortnight[fortnightId][userId] += amount;
        }
      });

      userIncomeData = Object.entries(incomeByFortnight).map(
        ([fortnightId, userAmounts]) => {
          const userIncome = Object.entries(userAmounts).map(
            ([userId, amount]) => {
              const incomeEntry = incomes.find(
                (inc) =>
                  inc.fortnight_id === parseInt(fortnightId, 10) &&
                  inc.user_id === parseInt(userId, 10),
              );
              return {
                userId: parseInt(userId, 10),
                userName: incomeEntry?.user?.name || 'Unknown',
                income: amount,
              };
            },
          );
          return {
            fortnightId: parseInt(fortnightId, 10),
            userIncome,
          };
        },
      );
    }
  }

  const fundingWallets = await prisma.wallet.findMany({
    where: {
      ...ownerFilter,
      active: true,
      type: {
        in: [PaymentMethodType.CASH, PaymentMethodType.DEBIT_CARD],
      },
    },
    select: {
      id: true,
      name: true,
      amount: true,
      type: true,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  const fundingWalletBreakdown = fundingWallets.map((w) => ({
    id: w.id,
    name: w.name,
    amount: Number(w.amount),
    type: w.type,
  }));
  const fundingWalletBalanceTotal = fundingWalletBreakdown.reduce(
    (s, w) => s + w.amount,
    0,
  );
  const fundingNetVsPendingExpense = fundingWalletBalanceTotal - totalUnpaid;

  return {
    totalIncome,
    totalExpense,
    totalPaid,
    totalUnpaid,
    balance,
    fundingWalletBalanceTotal,
    fundingNetVsPendingExpense,
    fundingWalletBreakdown,
    userIncome: userIncomeData,
    incomeItems,
    ...(excludeCreditInstallment
      ? {
          planningExpenseCount,
          planningPaidExpenseCount,
          planningUnpaidExpenseCount,
          cardCharges:
            cardTotal > 0 || cardExpenseCount > 0
              ? {
                  total: cardTotal,
                  paid: cardPaid,
                  unpaid: cardUnpaid,
                  expenseCount: cardExpenseCount,
                }
              : null,
          planningOrphanCardPayments:
            orphanCardPaymentCount > 0 || orphanCardPaymentTotal > 0
              ? {
                  total: orphanCardPaymentTotal,
                  count: orphanCardPaymentCount,
                }
              : null,
          planningCardStatementDue:
            planningCardStatementDueTotal > 0
              ? {
                  total: planningCardStatementDueTotal,
                  cardCount: planningCardStatementDueCardCount,
                }
              : null,
        }
      : {}),
  };
};
