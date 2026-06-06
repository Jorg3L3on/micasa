import { FortnightPeriod } from '@/generated/prisma/client';
import {
  getDuePaymentsForCurrentFortnight,
  getDuePaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-statement.service';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';
import { getMonthlyBudgetPanel } from '@/lib/finance/monthly-budget-panel.service';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import { measure } from './monthly.performance';
import {
  findFortnightsForCalendarKeys,
  fortnightCalendarKey,
  type FortnightCalendarKey,
} from './monthly.queries';
import type { GetMonthlyPageDataParams, MonthlyPageData } from './monthly.types';

const parseMonthString = (monthStr: string): number => parseInt(monthStr, 10);

const pickFortnight = (
  map: Awaited<ReturnType<typeof findFortnightsForCalendarKeys>>,
  key: FortnightCalendarKey,
) => map.get(fortnightCalendarKey(key)) ?? null;

export const getMonthlyPageData = async (
  params: GetMonthlyPageDataParams,
): Promise<MonthlyPageData> =>
  measure('monthly.total', async () => {
    const {
      ownerFilter,
      year,
      month,
      yearParam,
      monthParam,
      prevYear,
      prevMonthStr,
      nextYear,
      nextMonthStr,
      isCurrentMonth,
    } = params;

    const prevMonth = parseMonthString(prevMonthStr);
    const nextMonth = parseMonthString(nextMonthStr);

    const navKeys: FortnightCalendarKey[] = [
      { year, month, period: FortnightPeriod.FIRST },
      { year, month, period: FortnightPeriod.SECOND },
      { year: prevYear, month: prevMonth, period: FortnightPeriod.FIRST },
      { year: prevYear, month: prevMonth, period: FortnightPeriod.SECOND },
      { year: nextYear, month: nextMonth, period: FortnightPeriod.FIRST },
      { year: nextYear, month: nextMonth, period: FortnightPeriod.SECOND },
    ];

    const [fortnightMap, wallets, duePayments, plannerDue, plannerLoanDue] =
      await Promise.all([
        measure('monthly.fortnights', () =>
          findFortnightsForCalendarKeys(ownerFilter, navKeys),
        ),
        measure('monthly.wallets', async () => {
          const all = await listWalletsByOwner(ownerFilter);
          return all.filter((w) => w.active);
        }),
        measure('monthly.due-payments', () =>
          isCurrentMonth
            ? getDuePaymentsForCurrentFortnight(ownerFilter)
            : Promise.resolve([]),
        ),
        measure('monthly.card-dues', () =>
          getDuePaymentsForPlannerMonth(ownerFilter, year, month),
        ),
        measure('monthly.loan-dues', () =>
          listLoanPaymentsForPlannerMonth(ownerFilter, year, month),
        ),
      ]);

    const firstFortnightInfo = pickFortnight(fortnightMap, navKeys[0]);
    const secondFortnightInfo = pickFortnight(fortnightMap, navKeys[1]);
    const prevFirstInfo = pickFortnight(fortnightMap, navKeys[2]);
    const prevSecondInfo = pickFortnight(fortnightMap, navKeys[3]);
    const nextFirstInfo = pickFortnight(fortnightMap, navKeys[4]);
    const nextSecondInfo = pickFortnight(fortnightMap, navKeys[5]);

    if (firstFortnightInfo === null || secondFortnightInfo === null) {
      return {
        firstFortnightInfo,
        secondFortnightInfo,
        prevFirstInfo,
        prevSecondInfo,
        nextFirstInfo,
        nextSecondInfo,
        wallets,
        duePayments,
        plannerDue,
        plannerLoanDue,
        firstTransactions: [],
        secondTransactions: [],
        firstSummary: null,
        secondSummary: null,
        budgetPanel: await measure('monthly.budget-panel', () =>
          getMonthlyBudgetPanel(ownerFilter, year, month),
        ),
      };
    }

    const firstFortnightIds = [firstFortnightInfo.id];
    const secondFortnightIds = [secondFortnightInfo.id];

    const [
      firstTransactions,
      secondTransactions,
      firstSummary,
      secondSummary,
      budgetPanel,
    ] = await Promise.all([
        measure('monthly.transactions', () =>
          listPlanningTransactions({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'FIRST',
            type: 'expense',
            excludeCreditInstallment: true,
            resolvedFortnightIds: firstFortnightIds,
          }),
        ),
        measure('monthly.transactions', () =>
          listPlanningTransactions({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'SECOND',
            type: 'expense',
            excludeCreditInstallment: true,
            resolvedFortnightIds: secondFortnightIds,
          }),
        ),
        measure('monthly.reports', () =>
          getReportSummary({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'FIRST',
            excludeCreditInstallment: true,
            resolvedFortnightIds: firstFortnightIds,
          }),
        ),
        measure('monthly.reports', () =>
          getReportSummary({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'SECOND',
            excludeCreditInstallment: true,
            resolvedFortnightIds: secondFortnightIds,
          }),
        ),
        measure('monthly.budget-panel', () =>
          getMonthlyBudgetPanel(ownerFilter, year, month),
        ),
      ]);

    return {
      firstFortnightInfo,
      secondFortnightInfo,
      prevFirstInfo,
      prevSecondInfo,
      nextFirstInfo,
      nextSecondInfo,
      wallets,
      duePayments,
      plannerDue,
      plannerLoanDue,
      firstTransactions,
      secondTransactions,
      firstSummary,
      secondSummary,
      budgetPanel,
    };
  });
