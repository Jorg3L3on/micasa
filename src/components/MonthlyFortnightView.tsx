'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import WalletBalanceStrip from '@/components/WalletBalanceStrip';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { useRegisterMonthlyPanelRefresh } from '@/components/monthly/monthly-panel-refresh';
import {
  MONTHLY_PANEL_CONTENT_GRID_CLASS,
  MONTHLY_PANEL_MAIN_COLUMN_CLASS,
  MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS,
} from '@/components/monthly/MonthlyPanelLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import { useFinanceContext } from '@/context/finance-context';
import { isGoalWalletType } from '@/domain/payment-method';
import {
  clientFetchFromApi,
  isOwnerContextPending,
} from '@/lib/api/client-fetch';
import { fetchMonthlyPanelSnapshot } from '@/lib/api/monthly-panel';
import type {
  DuePaymentItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  ReportsSummaryFundingFields,
  TransactionRow,
  WalletListItem,
} from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';
import type { FinanceContextType } from '@/types/finance-context';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

type FortnightPeriod = 'FIRST' | 'SECOND';

type FortnightSummary = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems?: Array<{
    fortnightId: number;
    id: number;
    amount: number;
    source: string | null;
    userName: string | null;
    templateName: string | null;
    categoryId: number | null;
    incomeTemplateId: number | null;
    templateSuggestedAmount: number | null;
    templateCategoryId: number | null;
    templateWalletId: number | null;
    walletId: number | null;
  }>;
  planningExpenseCount?: number;
  planningPaidExpenseCount?: number;
  planningUnpaidExpenseCount?: number;
  cardCharges?: PlannerCardChargesSummary | null;
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null;
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
} & ReportsSummaryFundingFields;

type FortnightBundle = {
  label: string;
  transactions: TransactionRow[];
  summary: FortnightSummary | null;
  fortnightId: number;
  cardDueItems?: DuePaymentItem[];
  loanDueItems?: LoanDuePaymentItem[];
  loadedOnServer?: boolean;
};

export type MonthlyFortnightViewProps = {
  ownerKey: string;
  year: number;
  month: number;
  first: FortnightBundle;
  second: FortnightBundle;
  wallets?: WalletListItem[];
  paidWalletIds: number[];
  isCurrentMonth: boolean;
  budgetPanel?: MonthlyBudgetPanelResult | null;
  budgetOwnerQuery?: string;
  serverLoadedPeriod: FortnightPeriod;
  loading?: boolean;
};

const planningQuerySuffix = '&exclude_credit_installment=true';

const fetchFortnightBundleData = async (
  year: number,
  month: number,
  period: FortnightPeriod,
  context: FinanceContextType,
): Promise<Pick<FortnightBundle, 'transactions' | 'summary'>> => {
  const ym = String(month).padStart(2, '0');
  const [transactions, summary] = await Promise.all([
    clientFetchFromApi<TransactionRow[]>(
      `/api/transactions?year=${year}&month=${ym}&period=${period}&type=expense${planningQuerySuffix}`,
      undefined,
      context,
    ),
    clientFetchFromApi<FortnightSummary>(
      `/api/reports?type=summary&year=${year}&month=${ym}&period=${period}${planningQuerySuffix}`,
      undefined,
      context,
    ),
  ]);
  return { transactions, summary };
};

export default function MonthlyFortnightView({
  ownerKey,
  year,
  month,
  first,
  second,
  wallets = [],
  paidWalletIds,
  isCurrentMonth,
  budgetPanel = null,
  budgetOwnerQuery = '',
  serverLoadedPeriod,
  loading = false,
}: MonthlyFortnightViewProps) {
  const { period } = useMonthlyPanelPreferences();
  const { context } = useFinanceContext();
  const ownerPending = isOwnerContextPending(context, ownerKey);

  const [firstBundle, setFirstBundle] = useState(first);
  const [secondBundle, setSecondBundle] = useState(second);
  const [panelWallets, setPanelWallets] = useState(wallets);
  const [panelBudget, setPanelBudget] = useState(budgetPanel);
  const [loadingPeriod, setLoadingPeriod] = useState<FortnightPeriod | null>(
    null,
  );

  const [summaryFundingRefreshNonce, setSummaryFundingRefreshNonce] =
    useState(0);

  useEffect(() => {
    setFirstBundle(first);
    setSecondBundle(second);
    setPanelWallets(wallets);
    setPanelBudget(budgetPanel);
  }, [first, second, wallets, budgetPanel, ownerKey]);

  const refreshPanelData = useCallback(async () => {
    const snapshot = await fetchMonthlyPanelSnapshot<FortnightSummary>(
      year,
      month,
      context,
    );
    setFirstBundle((current) => ({
      ...current,
      transactions: snapshot.first.transactions,
      summary: snapshot.first.summary,
      cardDueItems: snapshot.cardDues.first,
      loanDueItems: snapshot.loanDues.first,
    }));
    setSecondBundle((current) => ({
      ...current,
      transactions: snapshot.second.transactions,
      summary: snapshot.second.summary,
      cardDueItems: snapshot.cardDues.second,
      loanDueItems: snapshot.loanDues.second,
    }));
    setPanelBudget(snapshot.budgetPanel);
    setPanelWallets(snapshot.wallets);
  }, [context, month, year]);

  useRegisterMonthlyPanelRefresh(loading ? null : refreshPanelData);

  const prefetchInactivePeriod = useCallback(
    async (inactivePeriod: FortnightPeriod) => {
      const bundle = inactivePeriod === 'FIRST' ? firstBundle : secondBundle;
      if (bundle.summary != null) return;

      setLoadingPeriod(inactivePeriod);
      try {
        const data = await fetchFortnightBundleData(
          year,
          month,
          inactivePeriod,
          context,
        );
        if (inactivePeriod === 'FIRST') {
          setFirstBundle((prev) => ({ ...prev, ...data }));
        } else {
          setSecondBundle((prev) => ({ ...prev, ...data }));
        }
      } catch (error) {
        console.error('Error loading fortnight data:', error);
      } finally {
        setLoadingPeriod((current) =>
          current === inactivePeriod ? null : current,
        );
      }
    },
    [context, firstBundle, secondBundle, month, year],
  );

  const inactivePeriod: FortnightPeriod =
    serverLoadedPeriod === 'FIRST' ? 'SECOND' : 'FIRST';
  const inactivePrefetchedRef = useRef(false);

  useEffect(() => {
    inactivePrefetchedRef.current = false;
  }, [ownerKey, year, month, serverLoadedPeriod]);

  useEffect(() => {
    if (loading || ownerPending) return;

    const bundle = period === 'FIRST' ? firstBundle : secondBundle;
    if (bundle.summary == null) {
      void prefetchInactivePeriod(period);
    }
  }, [
    period,
    firstBundle,
    secondBundle,
    loading,
    ownerPending,
    prefetchInactivePeriod,
  ]);

  useEffect(() => {
    if (loading || ownerPending) return;
    if (inactivePrefetchedRef.current) return;

    const inactiveBundle =
      inactivePeriod === 'FIRST' ? firstBundle : secondBundle;
    if (inactiveBundle.summary != null) {
      inactivePrefetchedRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      inactivePrefetchedRef.current = true;
      void prefetchInactivePeriod(inactivePeriod);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [
    firstBundle,
    inactivePeriod,
    loading,
    ownerPending,
    prefetchInactivePeriod,
    secondBundle,
  ]);

  const activeBundle = period === 'FIRST' ? firstBundle : secondBundle;
  const preferenceScope = `${ownerKey}-${year}-${month}`;

  const handleWalletBalancesPersisted = useCallback(() => {
    setSummaryFundingRefreshNonce((n) => n + 1);
  }, []);

  /** Goals live under Metas — panel strip is billeteras only. */
  const stripWallets = useMemo(
    () => panelWallets.filter((w) => !isGoalWalletType(w.type)),
    [panelWallets],
  );

  const walletStripSection =
    !ownerPending && stripWallets.length > 0 ? (
      <div className="mb-7 min-w-0">
        <WalletBalanceStrip
          wallets={stripWallets}
          paidWalletIds={paidWalletIds}
          isCurrentMonth={isCurrentMonth}
          onBalancesPersisted={handleWalletBalancesPersisted}
        />
      </div>
    ) : null;

  const columnSkeleton = (
    <div
      className="space-y-3"
      role="status"
      aria-busy="true"
      aria-label="Cargando quincena"
    >
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-lg border border-border/60" />
        <Skeleton className="h-52 w-full rounded-lg border border-border/60" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {walletStripSection}
        {columnSkeleton}
      </div>
    );
  }

  const budgetSidebar = (
    <div className={MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS}>
      {panelBudget ? (
        <MonthlyBudgetSidebar
          panel={panelBudget}
          ownerQuery={budgetOwnerQuery}
        />
      ) : (
        <Skeleton className="h-64 w-full rounded-xl border border-border/60" />
      )}
    </div>
  );

  const activeSummary = activeBundle.summary;
  const columnReady =
    !ownerPending && activeSummary != null && loadingPeriod !== period;

  return (
    <div className={MONTHLY_PANEL_CONTENT_GRID_CLASS}>
      <div className={MONTHLY_PANEL_MAIN_COLUMN_CLASS}>
        <div className="space-y-4">
          {walletStripSection}
          {columnReady && activeSummary ? (
            <FortnightColumn
              key={`${ownerKey}-${year}-${month}-${period}-${activeBundle.fortnightId}`}
              label={activeBundle.label}
              transactions={activeBundle.transactions}
              summary={activeSummary}
              fortnightId={activeBundle.fortnightId}
              year={year}
              month={month}
              period={period}
              cardDueItems={activeBundle.cardDueItems}
              loanDueItems={activeBundle.loanDueItems}
              wallets={panelWallets}
              summaryFundingRefreshNonce={summaryFundingRefreshNonce}
              preferenceScope={preferenceScope}
              dualColumnLayout={false}
              budgetPanel={panelBudget}
              budgetOwnerQuery={budgetOwnerQuery}
              onPanelRefresh={refreshPanelData}
            />
          ) : (
            columnSkeleton
          )}
        </div>
      </div>
      {budgetSidebar}
    </div>
  );
}
