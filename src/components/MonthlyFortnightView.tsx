'use client';

import { useCallback } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { FortnightViewControls } from '@/components/monthly/FortnightViewControls';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
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
  summary: FortnightSummary;
  fortnightId: number;
  cardDueItems?: DuePaymentItem[];
  loanDueItems?: LoanDuePaymentItem[];
};

export type MonthlyFortnightViewProps = {
  ownerKey: string;
  year: number;
  month: number;
  first: FortnightBundle;
  second: FortnightBundle;
  wallets?: WalletListItem[];
};

export default function MonthlyFortnightView({
  ownerKey,
  year,
  month,
  first,
  second,
  wallets = [],
}: MonthlyFortnightViewProps) {
  const {
    prefsReady,
    period,
    summaryVisible,
    setPeriod,
    setSummaryVisible,
  } = useMonthlyPanelPreferences();

  const activeBundle = period === 'FIRST' ? first : second;
  const preferenceScope = `${ownerKey}-${year}-${month}`;

  const handleShowSummaryFromColumn = useCallback(() => {
    setSummaryVisible(true);
  }, [setSummaryVisible]);

  if (!prefsReady) {
    return (
      <div className="space-y-4">
        <div
          className="space-y-3"
          role="status"
          aria-busy="true"
          aria-label="Cargando preferencias de vista"
        >
          <div className="flex justify-start sm:justify-end">
            <Skeleton className="h-8 w-40 rounded-lg" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-lg border border-border/60" />
            <Skeleton className="h-52 w-full rounded-lg border border-border/60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FortnightViewControls
        year={year}
        month={month}
        period={period}
        firstLabel={first.label}
        secondLabel={second.label}
        summaryVisible={summaryVisible}
        onPeriodChange={setPeriod}
        onSummaryVisibleChange={setSummaryVisible}
      />

      <FortnightColumn
        key={`${ownerKey}-${year}-${month}-${period}`}
        label={activeBundle.label}
        transactions={activeBundle.transactions}
        summary={activeBundle.summary}
        fortnightId={activeBundle.fortnightId}
        year={year}
        month={month}
        period={period}
        showSummaryCard={summaryVisible}
        onShowSummaryCard={handleShowSummaryFromColumn}
        cardDueItems={activeBundle.cardDueItems}
        loanDueItems={activeBundle.loanDueItems}
        wallets={wallets}
        preferenceScope={preferenceScope}
        dualColumnLayout={false}
      />
    </div>
  );
}
