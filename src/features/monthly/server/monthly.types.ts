import type { ReportSummaryResult } from '@/lib/finance/report-summary.service';
import type { TransactionRow } from '@/types/catalog';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  DuePaymentItem,
  PlannerDuePaymentsResponse,
  WalletListItem,
} from '@/types/catalog';
import type { PlannerLoanPaymentsResponse } from '@/types/loans';
import type { FortnightNavInfo } from './monthly.queries';

export type MonthlyFortnightSummary = ReportSummaryResult;

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
};

export type GetMonthlyPageDataParams = {
  ownerFilter: OwnerFilter;
  year: number;
  month: number;
  yearParam: string;
  monthParam: string;
  prevYear: number;
  prevMonthStr: string;
  nextYear: number;
  nextMonthStr: string;
  isCurrentMonth: boolean;
};
