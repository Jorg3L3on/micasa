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
import { sumPlannerLoanDueForFortnight } from '@/lib/finance/loan.service';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import { applyWalletLoanDueToExpenseTotals } from '@/lib/finance/planning-period-loan-totals';
import {
  buildExpenseWhereForFortnightScope,
  parseFortnightPeriod,
} from '@/lib/finance/report-helpers';
import type { FundingWalletBreakdownRow } from '@/lib/finance/funding-wallet-breakdown';
import { getFortnightPlanningBudgetRemaining } from '@/lib/finance/monthly-budget-panel.service';

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
    provider_icon_key: string | null;
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
  /** Cuotas pendientes pagadas desde billetera (pestaña Préstamos). */
  planningWalletLoanDue?: { total: number; count: number } | null;
  /** Deducciones de nómina pendientes (pestaña Préstamos); reducen el ingreso disponible. */
  planningPayrollLoanDeduction?: { total: number; count: number } | null;
  /**
   * Resto del presupuesto de la quincena (total − spent).
   * Cuenta como compromiso en gauge / libre / liquidez sin duplicar lo ya en Pagado.
   */
  planningBudgetRemaining?: number;
};

export type GetReportSummaryParams = {
  ownerFilter: OwnerFilter;
  month?: string | null;
  year?: string | null;
  period?: string | null;
  excludeCreditInstallment: boolean;
  /** When set, skips re-resolving fortnights for the scoped month/period. */
  resolvedFortnightIds?: number[];
  /** Precomputed from monthly budget panel to avoid redundant panel loads. */
  planningBudgetRemaining?: number;
  /** Precomputed from wave-1 wallets to avoid redundant wallet queries. */
  fundingWalletBreakdown?: FundingWalletBreakdownRow[];
};

export const getReportSummary = async (
  params: GetReportSummaryParams,
): Promise<ReportSummaryResult> => {
  const {
    ownerFilter,
    month,
    year,
    period,
    excludeCreditInstallment,
    resolvedFortnightIds,
    planningBudgetRemaining: precomputedBudgetRemaining,
    fundingWalletBreakdown: precomputedFundingWallets,
  } = params;

  const baseWhere = await buildExpenseWhereForFortnightScope(
    ownerFilter,
    month,
    year,
    period,
    resolvedFortnightIds,
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
  let scopedFortnightIds: number[] | undefined;
  if (resolvedFortnightIds !== undefined) {
    scopedFortnightIds = resolvedFortnightIds;
  } else if (month || year || period) {
    const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
    const parsedPeriod = parseFortnightPeriod(period);
    if (month) fortnightWhere.month = parseInt(month, 10);
    if (year) fortnightWhere.year = parseInt(year, 10);
    if (parsedPeriod) fortnightWhere.period = parsedPeriod;

    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere,
      select: { id: true },
    });
    scopedFortnightIds = fortnights.map((f) => f.id);
  }
  if (scopedFortnightIds !== undefined) {
    incomeWhere.fortnight_id = {
      in: scopedFortnightIds.length > 0 ? scopedFortnightIds : [],
    };
  }

  const incomeRows =
    scopedFortnightIds !== undefined && scopedFortnightIds.length > 0
      ? await prisma.income.findMany({
          where: incomeWhere,
          include: {
            user: { select: { id: true, name: true } },
            income_template: { select: { name: true } },
          },
        })
      : [];

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
  let planningWalletLoanDueTotal = 0;
  let planningWalletLoanDueCount = 0;
  let planningPayrollLoanDeductionTotal = 0;
  let planningPayrollLoanDeductionCount = 0;
  if (
    excludeCreditInstallment &&
    year &&
    month &&
    period &&
    (period === 'FIRST' || period === 'SECOND')
  ) {
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);
    const [cardDue, loanDue] = await Promise.all([
      sumPlannerCardDueForFortnight(
        ownerFilter,
        parsedYear,
        parsedMonth,
        period,
      ),
      sumPlannerLoanDueForFortnight(
        ownerFilter,
        parsedYear,
        parsedMonth,
        period,
      ),
    ]);
    planningCardStatementDueTotal = cardDue.total;
    planningCardStatementDueCardCount = cardDue.cardCount;
    planningWalletLoanDueTotal = loanDue.wallet.total;
    planningWalletLoanDueCount = loanDue.wallet.count;
    planningPayrollLoanDeductionTotal = loanDue.payroll.total;
    planningPayrollLoanDeductionCount = loanDue.payroll.count;
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
  const withLoanTotals = applyWalletLoanDueToExpenseTotals(
    planningTotals,
    excludeCreditInstallment && planningWalletLoanDueTotal > 0
      ? {
          total: planningWalletLoanDueTotal,
          count: planningWalletLoanDueCount,
        }
      : null,
  );
  totalExpense = withLoanTotals.totalExpense;
  totalPaid = withLoanTotals.totalPaid;
  const totalUnpaid = withLoanTotals.totalUnpaid;

  const overrideIncome = incomeRows.find((inc) => inc.source === '__OVERRIDE__');
  const regularIncome = incomeRows.filter((inc) => inc.source !== '__OVERRIDE__');

  const totalIncome = overrideIncome
    ? Number(overrideIncome.amount)
    : regularIncome.reduce((sum, inc) => sum + Number(inc.amount), 0);

  const yearNum = year != null && year !== '' ? Number.parseInt(year, 10) : NaN;
  const monthNum =
    month != null && month !== '' ? Number.parseInt(month, 10) : NaN;
  const parsedPeriod = parseFortnightPeriod(period);
  let planningBudgetRemaining = 0;
  if (
    excludeCreditInstallment &&
    Number.isFinite(yearNum) &&
    Number.isFinite(monthNum) &&
    parsedPeriod
  ) {
    planningBudgetRemaining =
      precomputedBudgetRemaining ??
      (await getFortnightPlanningBudgetRemaining(
        ownerFilter,
        yearNum,
        monthNum,
        parsedPeriod,
      ));
  }

  const balance =
    totalIncome -
    planningPayrollLoanDeductionTotal -
    totalExpense -
    planningBudgetRemaining;

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
  let planningUnpaidExpenseCount = excludeCreditInstallment
    ? expenses.filter((e) => !e.is_paid).length
    : undefined;

  if (excludeCreditInstallment && orphanCardPaymentCount > 0) {
    planningExpenseCount = (planningExpenseCount ?? 0) + orphanCardPaymentCount;
    planningPaidExpenseCount =
      (planningPaidExpenseCount ?? 0) + orphanCardPaymentCount;
  }
  if (excludeCreditInstallment && planningWalletLoanDueCount > 0) {
    planningExpenseCount =
      (planningExpenseCount ?? 0) + planningWalletLoanDueCount;
    planningUnpaidExpenseCount =
      (planningUnpaidExpenseCount ?? 0) + planningWalletLoanDueCount;
  }
  if (excludeCreditInstallment && planningPayrollLoanDeductionCount > 0) {
    planningExpenseCount =
      (planningExpenseCount ?? 0) + planningPayrollLoanDeductionCount;
    planningUnpaidExpenseCount =
      (planningUnpaidExpenseCount ?? 0) + planningPayrollLoanDeductionCount;
  }

  let userIncomeData: ReportSummaryResult['userIncome'] = [];
  const incomeItems: ReportSummaryResult['incomeItems'] = [];

  if (incomeRows.length > 0) {
    incomeRows.forEach((inc) => {
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
    const userNamesByFortnightUser: Record<
      number,
      Record<number, string>
    > = {};

    incomeRows
      .filter((inc) => inc.source !== '__OVERRIDE__')
      .forEach((inc) => {
        const fortnightId = inc.fortnight_id;
        const userId = inc.user_id;
        if (!userId) return;

        const amount = Number(inc.amount);
        if (!incomeByFortnight[fortnightId]) {
          incomeByFortnight[fortnightId] = {};
        }
        if (!incomeByFortnight[fortnightId][userId]) {
          incomeByFortnight[fortnightId][userId] = 0;
        }
        incomeByFortnight[fortnightId][userId] += amount;

        if (inc.user?.name) {
          if (!userNamesByFortnightUser[fortnightId]) {
            userNamesByFortnightUser[fortnightId] = {};
          }
          userNamesByFortnightUser[fortnightId][userId] = inc.user.name;
        }
      });

    userIncomeData = Object.entries(incomeByFortnight).map(
      ([fortnightId, userAmounts]) => ({
        fortnightId: parseInt(fortnightId, 10),
        userIncome: Object.entries(userAmounts).map(([userId, amount]) => ({
          userId: parseInt(userId, 10),
          userName:
            userNamesByFortnightUser[parseInt(fortnightId, 10)]?.[
              parseInt(userId, 10)
            ] ?? 'Unknown',
          income: amount,
        })),
      }),
    );
  }

  const fundingWalletBreakdown =
    precomputedFundingWallets ??
    (
      await prisma.wallet.findMany({
        where: {
          ...ownerFilter,
          active: true,
          include_in_liquidity: true,
          type: {
            in: [PaymentMethodType.CASH, PaymentMethodType.DEBIT_CARD],
          },
        },
        select: {
          id: true,
          name: true,
          amount: true,
          type: true,
          provider_icon_key: true,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      })
    ).map((w) => ({
      id: w.id,
      name: w.name,
      amount: Number(w.amount),
      type: w.type,
      provider_icon_key: w.provider_icon_key,
    }));
  const fundingWalletBalanceTotal = fundingWalletBreakdown.reduce(
    (s, w) => s + w.amount,
    0,
  );
  const fundingNetVsPendingExpense =
    fundingWalletBalanceTotal -
    totalUnpaid -
    planningPayrollLoanDeductionTotal -
    planningBudgetRemaining;

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
          planningBudgetRemaining,
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
          planningWalletLoanDue:
            planningWalletLoanDueTotal > 0
              ? {
                  total: planningWalletLoanDueTotal,
                  count: planningWalletLoanDueCount,
                }
              : null,
          planningPayrollLoanDeduction:
            planningPayrollLoanDeductionTotal > 0
              ? {
                  total: planningPayrollLoanDeductionTotal,
                  count: planningPayrollLoanDeductionCount,
                }
              : null,
        }
      : {}),
  };
};
