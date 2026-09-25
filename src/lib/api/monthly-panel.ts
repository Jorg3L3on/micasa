'use client';

import { getPlannerDuePayments } from '@/lib/api/card-payment-plans';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getPlannerLoanPayments } from '@/lib/api/loans';
import type {
  PlannerDuePaymentsResponse,
  TransactionRow,
  WalletListItem,
} from '@/types/catalog';
import type { FinanceContextType } from '@/types/finance-context';
import type { PlannerLoanPaymentsResponse } from '@/types/loans';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

const planningQuerySuffix = '&exclude_credit_installment=true';

export type FortnightSlice<TSummary> = {
  transactions: TransactionRow[];
  summary: TSummary;
};

export type MonthlyPanelSnapshot<TSummary> = {
  first: FortnightSlice<TSummary>;
  second: FortnightSlice<TSummary>;
  budgetPanel: MonthlyBudgetPanelResult;
  wallets: WalletListItem[];
  cardDues: PlannerDuePaymentsResponse;
  loanDues: PlannerLoanPaymentsResponse;
};

const fetchFortnightSlice = async <TSummary>(
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
  context: FinanceContextType,
): Promise<FortnightSlice<TSummary>> => {
  const ym = String(month).padStart(2, '0');
  const [transactions, summary] = await Promise.all([
    clientFetchFromApi<TransactionRow[]>(
      `/api/transactions?year=${year}&month=${ym}&period=${period}&type=expense${planningQuerySuffix}`,
      undefined,
      context,
    ),
    clientFetchFromApi<TSummary>(
      `/api/reports?type=summary&year=${year}&month=${ym}&period=${period}${planningQuerySuffix}`,
      undefined,
      context,
    ),
  ]);
  return { transactions, summary };
};

/** Reloads the panel pieces that a save changes, without a route refresh. */
export const fetchMonthlyPanelSnapshot = async <TSummary>(
  year: number,
  month: number,
  context: FinanceContextType,
): Promise<MonthlyPanelSnapshot<TSummary>> => {
  const ym = String(month).padStart(2, '0');
  const [first, second, budgetPanel, walletList, cardDues, loanDues] =
    await Promise.all([
      fetchFortnightSlice<TSummary>(year, month, 'FIRST', context),
      fetchFortnightSlice<TSummary>(year, month, 'SECOND', context),
      clientFetchFromApi<MonthlyBudgetPanelResult>(
        `/api/monthly/${year}/${ym}/budget-panel`,
        undefined,
        context,
      ),
      clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
      getPlannerDuePayments(year, month, context),
      getPlannerLoanPayments(year, month, context),
    ]);

  return {
    first,
    second,
    budgetPanel,
    wallets: walletList.filter((wallet) => wallet.active),
    cardDues,
    loanDues,
  };
};
