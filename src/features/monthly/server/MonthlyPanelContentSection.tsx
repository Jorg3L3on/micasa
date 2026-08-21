import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import MonthlyFortnightView from '@/components/MonthlyFortnightView';
import {
  MONTHLY_PANEL_CONTENT_GRID_CLASS,
  MONTHLY_PANEL_MAIN_COLUMN_CLASS,
  MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS,
} from '@/components/monthly/MonthlyPanelLayout';
import {
  ContentEnter,
  SkeletonExit,
} from '@/components/view-transition/SuspenseReveal';
import { getMonthlyFortnightContentData } from '@/features/monthly/server/monthly.service';
import type { MonthlyPanelShellData } from '@/features/monthly/server/monthly.types';
import type { MonthlyFortnightPeriod } from '@/features/monthly/server/monthly.types';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { ReportSummaryResult } from '@/lib/finance/report-summary.service';
import type { DuePaymentItem, TransactionRow, WalletListItem } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';

type MonthlyPanelContentSectionProps = {
  ownerFilter: OwnerFilter;
  ownerKey: string;
  year: number;
  month: number;
  yearParam: string;
  monthParam: string;
  activePeriod: MonthlyFortnightPeriod;
  shell: MonthlyPanelShellData;
  ownerQuery: string;
  firstLabel: string;
  secondLabel: string;
  firstFortnightId: number;
  secondFortnightId: number;
  paidWalletIds: number[];
  isCurrentMonth: boolean;
  monthIsMissing: boolean;
};

const buildFortnightBundle = (params: {
  label: string;
  fortnightId: number;
  transactions: TransactionRow[];
  summary: ReportSummaryResult | null;
  cardDueItems: DuePaymentItem[];
  loanDueItems: LoanDuePaymentItem[];
}) => ({
  label: params.label,
  transactions: params.transactions,
  summary: params.summary,
  fortnightId: params.fortnightId,
  cardDueItems: params.cardDueItems,
  loanDueItems: params.loanDueItems,
  loadedOnServer: params.summary != null,
});

export const MonthlyPanelContentSection = async ({
  ownerFilter,
  ownerKey,
  year,
  month,
  yearParam,
  monthParam,
  activePeriod,
  shell,
  ownerQuery,
  firstLabel,
  secondLabel,
  firstFortnightId,
  secondFortnightId,
  paidWalletIds,
  isCurrentMonth,
  monthIsMissing,
}: MonthlyPanelContentSectionProps) => {
  if (monthIsMissing) {
    return null;
  }

  const content = await getMonthlyFortnightContentData({
    ownerFilter,
    year,
    month,
    yearParam,
    monthParam,
    activePeriod,
    shell,
  });

  const cardDueFirst = shell.plannerDue.first;
  const cardDueSecond = shell.plannerDue.second;
  const loanDueFirst = shell.plannerLoanDue.first;
  const loanDueSecond = shell.plannerLoanDue.second;

  return (
    <div className={MONTHLY_PANEL_CONTENT_GRID_CLASS}>
      <div className={MONTHLY_PANEL_MAIN_COLUMN_CLASS}>
        <MonthlyFortnightView
          ownerKey={ownerKey}
          year={year}
          month={month}
          wallets={shell.wallets}
          paidWalletIds={paidWalletIds}
          isCurrentMonth={isCurrentMonth}
          budgetPanel={content.budgetPanel}
          budgetOwnerQuery={ownerQuery}
          serverLoadedPeriod={content.loadedPeriod}
          first={buildFortnightBundle({
            label: firstLabel,
            fortnightId: firstFortnightId,
            transactions: content.firstTransactions,
            summary: content.firstSummary,
            cardDueItems: cardDueFirst,
            loanDueItems: loanDueFirst,
          })}
          second={buildFortnightBundle({
            label: secondLabel,
            fortnightId: secondFortnightId,
            transactions: content.secondTransactions,
            summary: content.secondSummary,
            cardDueItems: cardDueSecond,
            loanDueItems: loanDueSecond,
          })}
        />
      </div>
      <div className={MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS}>
        <MonthlyBudgetSidebar
          panel={content.budgetPanel}
          ownerQuery={ownerQuery}
        />
      </div>
    </div>
  );
};

export const MonthlyPanelContentFallback = ({
  wallets = [],
  paidWalletIds = [],
  isCurrentMonth = false,
}: {
  wallets?: WalletListItem[];
  paidWalletIds?: number[];
  isCurrentMonth?: boolean;
}) => (
  <SkeletonExit>
    <div className={MONTHLY_PANEL_CONTENT_GRID_CLASS}>
      <div className={MONTHLY_PANEL_MAIN_COLUMN_CLASS}>
        <MonthlyFortnightView
          ownerKey="loading"
          year={2000}
          month={1}
          wallets={wallets}
          paidWalletIds={paidWalletIds}
          isCurrentMonth={isCurrentMonth}
          serverLoadedPeriod="FIRST"
          loading
          first={{
            label: '',
            transactions: [],
            summary: null,
            fortnightId: 0,
          }}
          second={{
            label: '',
            transactions: [],
            summary: null,
            fortnightId: 0,
          }}
        />
      </div>
      <div className={MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS}>
        <Skeleton className="h-64 w-full rounded-xl border border-border/60" />
      </div>
    </div>
  </SkeletonExit>
);

export const MonthlyPanelContentSuspense = (
  props: MonthlyPanelContentSectionProps,
) => (
  <Suspense
    fallback={
      <MonthlyPanelContentFallback
        wallets={props.shell.wallets}
        paidWalletIds={props.paidWalletIds}
        isCurrentMonth={props.isCurrentMonth}
      />
    }
  >
    <ContentEnter>
      <MonthlyPanelContentSection {...props} />
    </ContentEnter>
  </Suspense>
);
