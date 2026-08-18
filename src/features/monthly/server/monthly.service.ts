import { FortnightPeriod } from '@/generated/prisma/client';
import {
  getDuePaymentsForCurrentFortnight,
  getDuePaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-statement.service';
import { buildFundingWalletBreakdownFromWallets } from '@/lib/finance/funding-wallet-breakdown';
import { listLoanPaymentsForPlannerMonth } from '@/lib/finance/loan.service';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';
import { ensureBudgetPeriodsForMonth } from '@/lib/finance/budget-period.service';
import { getMonthlyBudgetPanel } from '@/lib/finance/monthly-budget-panel.service';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import { measure } from './monthly.performance';
import {
  findFortnightsForCalendarKeys,
  fortnightCalendarKey,
  type FortnightCalendarKey,
} from './monthly.queries';
import type {
  GetMonthlyFortnightContentParams,
  GetMonthlyPageDataParams,
  GetMonthlyPanelShellParams,
  MonthlyFortnightContentData,
  MonthlyPageData,
  MonthlyPanelShellData,
} from './monthly.types';

const parseMonthString = (monthStr: string): number => parseInt(monthStr, 10);

const pickFortnight = (
  map: Awaited<ReturnType<typeof findFortnightsForCalendarKeys>>,
  key: FortnightCalendarKey,
) => map.get(fortnightCalendarKey(key)) ?? null;

const buildNavKeys = (
  year: number,
  month: number,
  prevYear: number,
  prevMonthStr: string,
  nextYear: number,
  nextMonthStr: string,
): FortnightCalendarKey[] => {
  const prevMonth = parseMonthString(prevMonthStr);
  const nextMonth = parseMonthString(nextMonthStr);
  return [
    { year, month, period: FortnightPeriod.FIRST },
    { year, month, period: FortnightPeriod.SECOND },
    { year: prevYear, month: prevMonth, period: FortnightPeriod.FIRST },
    { year: prevYear, month: prevMonth, period: FortnightPeriod.SECOND },
    { year: nextYear, month: nextMonth, period: FortnightPeriod.FIRST },
    { year: nextYear, month: nextMonth, period: FortnightPeriod.SECOND },
  ];
};

export const getMonthlyPanelShellData = async (
  params: GetMonthlyPanelShellParams,
): Promise<MonthlyPanelShellData> => {
  const {
    ownerFilter,
    year,
    month,
    prevYear,
    prevMonthStr,
    nextYear,
    nextMonthStr,
    isCurrentMonth,
  } = params;

  const navKeys = buildNavKeys(
    year,
    month,
    prevYear,
    prevMonthStr,
    nextYear,
    nextMonthStr,
  );

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

  return {
    fortnightMap,
    navKeys,
    wallets,
    duePayments,
    plannerDue,
    plannerLoanDue,
    fundingWalletBreakdown: buildFundingWalletBreakdownFromWallets(wallets),
  };
};

export const getMonthlyFortnightContentData = async (
  params: GetMonthlyFortnightContentParams,
): Promise<MonthlyFortnightContentData> => {
  const {
    ownerFilter,
    year,
    month,
    yearParam,
    monthParam,
    activePeriod,
    shell,
  } = params;

  const firstFortnightInfo = pickFortnight(shell.fortnightMap, shell.navKeys[0]);
  const secondFortnightInfo = pickFortnight(shell.fortnightMap, shell.navKeys[1]);

  if (firstFortnightInfo === null || secondFortnightInfo === null) {
    return {
      firstTransactions: [],
      secondTransactions: [],
      firstSummary: null,
      secondSummary: null,
      budgetPanel: await measure('monthly.budget-panel', () =>
        getMonthlyBudgetPanel(ownerFilter, year, month),
      ),
      loadedPeriod: activePeriod,
    };
  }

  await measure('monthly.budget-periods', () =>
    ensureBudgetPeriodsForMonth(ownerFilter, year, month),
  );

  const budgetPanel = await measure('monthly.budget-panel', () =>
    getMonthlyBudgetPanel(ownerFilter, year, month),
  );

  const activeFortnightIds =
    activePeriod === 'FIRST'
      ? [firstFortnightInfo.id]
      : [secondFortnightInfo.id];
  const planningBudgetRemaining =
    activePeriod === 'FIRST'
      ? budgetPanel.first.available
      : budgetPanel.second.available;

  const activeData = await measure('monthly.active-fortnight', () =>
    Promise.all([
      measure('monthly.transactions', () =>
        listPlanningTransactions({
          ownerFilter,
          year: yearParam,
          month: monthParam,
          period: activePeriod,
          type: 'expense',
          excludeCreditInstallment: true,
          resolvedFortnightIds: activeFortnightIds,
        }),
      ),
      measure('monthly.reports', () =>
        getReportSummary({
          ownerFilter,
          year: yearParam,
          month: monthParam,
          period: activePeriod,
          excludeCreditInstallment: true,
          resolvedFortnightIds: activeFortnightIds,
          planningBudgetRemaining,
          fundingWalletBreakdown: shell.fundingWalletBreakdown,
        }),
      ),
    ]).then(([transactions, summary]) => ({ transactions, summary })),
  );

  return {
    firstTransactions:
      activePeriod === 'FIRST' ? activeData.transactions : [],
    secondTransactions:
      activePeriod === 'SECOND' ? activeData.transactions : [],
    firstSummary: activePeriod === 'FIRST' ? activeData.summary : null,
    secondSummary: activePeriod === 'SECOND' ? activeData.summary : null,
    budgetPanel,
    loadedPeriod: activePeriod,
  };
};

const assemblePageData = (
  shell: MonthlyPanelShellData,
  content: MonthlyFortnightContentData,
): MonthlyPageData => {
  const firstFortnightInfo = pickFortnight(shell.fortnightMap, shell.navKeys[0]);
  const secondFortnightInfo = pickFortnight(shell.fortnightMap, shell.navKeys[1]);
  const prevFirstInfo = pickFortnight(shell.fortnightMap, shell.navKeys[2]);
  const prevSecondInfo = pickFortnight(shell.fortnightMap, shell.navKeys[3]);
  const nextFirstInfo = pickFortnight(shell.fortnightMap, shell.navKeys[4]);
  const nextSecondInfo = pickFortnight(shell.fortnightMap, shell.navKeys[5]);

  return {
    firstFortnightInfo,
    secondFortnightInfo,
    prevFirstInfo,
    prevSecondInfo,
    nextFirstInfo,
    nextSecondInfo,
    wallets: shell.wallets,
    duePayments: shell.duePayments,
    plannerDue: shell.plannerDue,
    plannerLoanDue: shell.plannerLoanDue,
    firstTransactions: content.firstTransactions,
    secondTransactions: content.secondTransactions,
    firstSummary: content.firstSummary,
    secondSummary: content.secondSummary,
    budgetPanel: content.budgetPanel,
    loadedPeriod: content.loadedPeriod,
  };
};

export const getMonthlyPageData = async (
  params: GetMonthlyPageDataParams,
): Promise<MonthlyPageData> =>
  measure('monthly.total', async () => {
    const shell = await getMonthlyPanelShellData(params);
    const content = await getMonthlyFortnightContentData({
      ownerFilter: params.ownerFilter,
      year: params.year,
      month: params.month,
      yearParam: params.yearParam,
      monthParam: params.monthParam,
      activePeriod: params.activePeriod,
      shell,
    });
    return assemblePageData(shell, content);
  });
