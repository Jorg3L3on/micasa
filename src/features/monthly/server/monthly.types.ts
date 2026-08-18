import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import type { ReportSummaryResult } from '@/lib/finance/report-summary.service';
import type { TransactionRow } from '@/types/catalog';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  DuePaymentItem,
  PlannerDuePaymentsResponse,
  WalletListItem,
} from '@/types/catalog';
import type { PlannerLoanPaymentsResponse } from '@/types/loans';
import type { FundingWalletBreakdownRow } from '@/lib/finance/funding-wallet-breakdown';
import type {
  FortnightCalendarKey,
  FortnightNavInfo,
} from './monthly.queries';
import type { findFortnightsForCalendarKeys } from './monthly.queries';

export type MonthlyFortnightSummary = ReportSummaryResult;

export type MonthlyFortnightPeriod = 'FIRST' | 'SECOND';

export type MonthlyPageData = {
  firstFortnightInfo: FortnightNavInfo | null;
  secondFortnightInfo: FortnightNavInfo | null;
  prevFirstInfo: FortnightNavInfo | null;
  prevSecondInfo: FortnightNavInfo | null;
  nextFirstInfo: FortnightNavInfo | null;
  nextSecondInfo: FortnightNavInfo | null;
  wallets: WalletListItem[];
  duePayments: DuePaymentItem[];
  plannerDue: PlannerDuePaymentsResponse;
  plannerLoanDue: PlannerLoanPaymentsResponse;
  firstTransactions: TransactionRow[];
  secondTransactions: TransactionRow[];
  firstSummary: MonthlyFortnightSummary | null;
  secondSummary: MonthlyFortnightSummary | null;
  budgetPanel: MonthlyBudgetPanelResult;
  /** Fortnight whose transactions/summary were loaded on the server. */
  loadedPeriod: MonthlyFortnightPeriod;
};

export type GetMonthlyPanelShellParams = {
  ownerFilter: OwnerFilter;
  year: number;
  month: number;
  prevYear: number;
  prevMonthStr: string;
  nextYear: number;
  nextMonthStr: string;
  isCurrentMonth: boolean;
};

export type MonthlyPanelShellData = {
  fortnightMap: Awaited<ReturnType<typeof findFortnightsForCalendarKeys>>;
  navKeys: FortnightCalendarKey[];
  wallets: WalletListItem[];
  duePayments: DuePaymentItem[];
  plannerDue: PlannerDuePaymentsResponse;
  plannerLoanDue: PlannerLoanPaymentsResponse;
  fundingWalletBreakdown: FundingWalletBreakdownRow[];
};

export type GetMonthlyFortnightContentParams = {
  ownerFilter: OwnerFilter;
  year: number;
  month: number;
  yearParam: string;
  monthParam: string;
  activePeriod: MonthlyFortnightPeriod;
  shell: MonthlyPanelShellData;
};

export type MonthlyFortnightContentData = {
  firstTransactions: TransactionRow[];
  secondTransactions: TransactionRow[];
  firstSummary: MonthlyFortnightSummary | null;
  secondSummary: MonthlyFortnightSummary | null;
  budgetPanel: MonthlyBudgetPanelResult;
  loadedPeriod: MonthlyFortnightPeriod;
};

export type GetMonthlyPageDataParams = GetMonthlyPanelShellParams & {
  yearParam: string;
  monthParam: string;
  activePeriod: MonthlyFortnightPeriod;
};
