'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import WalletBalanceStrip from '@/components/WalletBalanceStrip';
import { Skeleton } from '@/components/ui/skeleton';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
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

  const [firstBundle, setFirstBundle] = useState(first);
  const [secondBundle, setSecondBundle] = useState(second);
  const [loadingPeriod, setLoadingPeriod] = useState<FortnightPeriod | null>(
    null,
  );

  const [summaryFundingRefreshNonce, setSummaryFundingRefreshNonce] =
    useState(0);

  useEffect(() => {
    setFirstBundle(first);
    setSecondBundle(second);
  }, [first, second]);

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
    if (loading) return;

    const bundle = period === 'FIRST' ? firstBundle : secondBundle;
    if (bundle.summary == null) {
      void prefetchInactivePeriod(period);
    }
  }, [period, firstBundle, secondBundle, loading, prefetchInactivePeriod]);

  useEffect(() => {
    if (loading) return;
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
    prefetchInactivePeriod,
    secondBundle,
  ]);

  const activeBundle = period === 'FIRST' ? firstBundle : secondBundle;
  const preferenceScope = `${ownerKey}-${year}-${month}`;

  const handleWalletBalancesPersisted = useCallback(() => {
    setSummaryFundingRefreshNonce((n) => n + 1);
  }, []);

  const walletStripSection =
    wallets.length > 0 ? (
      <div className="mb-7 min-w-0">
        <WalletBalanceStrip
          wallets={wallets}
          paidWalletIds={paidWalletIds}
          isCurrentMonth={isCurrentMonth}
          onBalancesPersisted={handleWalletBalancesPersisted}
        />
      </div>
    ) : null;

  const columnLoading =
    loading || loadingPeriod === period || activeBundle.summary == null;

  if (columnLoading || activeBundle.summary == null) {
    return (
      <div className="space-y-4">
        {walletStripSection}
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
      </div>
    );
  }

  const activeSummary = activeBundle.summary;

  return (
    <div className="space-y-4">
      {walletStripSection}

      <FortnightColumn
        key={`${ownerKey}-${year}-${month}-${period}`}
        label={activeBundle.label}
        transactions={activeBundle.transactions}
        summary={activeSummary}
        fortnightId={activeBundle.fortnightId}
        year={year}
        month={month}
        period={period}
        cardDueItems={activeBundle.cardDueItems}
        loanDueItems={activeBundle.loanDueItems}
        wallets={wallets}
        summaryFundingRefreshNonce={summaryFundingRefreshNonce}
        preferenceScope={preferenceScope}
        dualColumnLayout={false}
        budgetPanel={budgetPanel}
        budgetOwnerQuery={budgetOwnerQuery}
      />
    </div>
  );
}
