import { FortnightPeriod } from '@/generated/prisma/client';
import {
  getDuePaymentsForCurrentFortnight,
  getDuePaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-statement.service';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import { measure } from './monthly.performance';
import { findFortnightByCalendarPeriod } from './monthly.queries';
import type { GetMonthlyPageDataParams, MonthlyPageData } from './monthly.types';

const parseMonthString = (monthStr: string): number => parseInt(monthStr, 10);

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

    const [
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
    ] = await Promise.all([
      measure('monthly.fortnights', () =>
        findFortnightByCalendarPeriod(
          ownerFilter,
          year,
          month,
          FortnightPeriod.FIRST,
        ),
      ),
      measure('monthly.fortnights', () =>
        findFortnightByCalendarPeriod(
          ownerFilter,
          year,
          month,
          FortnightPeriod.SECOND,
        ),
      ),
      measure('monthly.fortnights', () =>
        findFortnightByCalendarPeriod(
          ownerFilter,
          prevYear,
          prevMonth,
          FortnightPeriod.FIRST,
        ),
      ),
      measure('monthly.fortnights', () =>
        findFortnightByCalendarPeriod(
          ownerFilter,
          prevYear,
          prevMonth,
          FortnightPeriod.SECOND,
        ),
      ),
      measure('monthly.fortnights', () =>
        findFortnightByCalendarPeriod(
          ownerFilter,
          nextYear,
          nextMonth,
          FortnightPeriod.FIRST,
        ),
      ),
      measure('monthly.fortnights', () =>
        findFortnightByCalendarPeriod(
          ownerFilter,
          nextYear,
          nextMonth,
          FortnightPeriod.SECOND,
        ),
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
      };
    }

    const [firstTransactions, secondTransactions, firstSummary, secondSummary] =
      await Promise.all([
        measure('monthly.transactions', () =>
          listPlanningTransactions({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'FIRST',
            type: 'expense',
            excludeCreditInstallment: true,
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
          }),
        ),
        measure('monthly.reports', () =>
          getReportSummary({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'FIRST',
            excludeCreditInstallment: true,
          }),
        ),
        measure('monthly.reports', () =>
          getReportSummary({
            ownerFilter,
            year: yearParam,
            month: monthParam,
            period: 'SECOND',
            excludeCreditInstallment: true,
          }),
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
    };
  });
