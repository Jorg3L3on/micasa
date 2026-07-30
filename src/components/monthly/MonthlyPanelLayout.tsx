'use client';

import type { ReactNode } from 'react';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { MonthlyFortnightCategoryPie } from '@/components/monthly/MonthlyFortnightCategoryPie';
import WalletBalanceStrip from '@/components/WalletBalanceStrip';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import type { TransactionRow, WalletListItem } from '@/types/catalog';
import { cn } from '@/lib/utils';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelLayoutProps = {
  ownerKey: string;
  year: number;
  month: number;
  todayYmd: string;
  suggestedPeriod: FortnightPeriod;
  ownerQuery: string;
  budgetPanel: MonthlyBudgetPanelResult;
  firstTransactions: TransactionRow[];
  secondTransactions: TransactionRow[];
  wallets: WalletListItem[];
  monthHeader: ReactNode;
  children: ReactNode;
};

type MonthlyPanelContentProps = Omit<
  MonthlyPanelLayoutProps,
  'ownerKey' | 'suggestedPeriod'
>;

const MonthlyPanelContent = ({
  year,
  month,
  todayYmd,
  ownerQuery,
  budgetPanel,
  firstTransactions,
  secondTransactions,
  wallets,
  monthHeader,
  children,
}: MonthlyPanelContentProps) => {
  return (
    <>
      <div
        className="mb-5 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:px-4"
        role="group"
        aria-label="Selector de mes"
      >
        {monthHeader}
      </div>

      {wallets.length > 0 ? (
        <div className="mb-6 min-w-0 xl:hidden">
          <WalletBalanceStrip wallets={wallets} />
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-6',
          'xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start',
        )}
      >
        <div className="mx-auto w-full min-w-0 max-w-4xl xl:max-w-none">
          {children}
        </div>
        <div className="flex min-w-0 flex-col gap-3.5">
          {wallets.length > 0 ? (
            <div className="hidden min-w-0 xl:block">
              <WalletBalanceStrip wallets={wallets} />
            </div>
          ) : null}
          <MonthlyBudgetSidebar
            panel={budgetPanel}
            ownerQuery={ownerQuery}
            year={year}
            month={month}
            todayYmd={todayYmd}
          />
          <MonthlyFortnightCategoryPie
            year={year}
            month={month}
            firstTransactions={firstTransactions}
            secondTransactions={secondTransactions}
          />
        </div>
      </div>
    </>
  );
};

export const MonthlyPanelLayout = ({
  ownerKey,
  suggestedPeriod,
  ...contentProps
}: MonthlyPanelLayoutProps) => {
  return (
    <MonthlyPanelPreferencesProvider
      ownerKey={ownerKey}
      year={contentProps.year}
      month={contentProps.month}
      suggestedPeriod={suggestedPeriod}
    >
      <MonthlyPanelContent {...contentProps} />
    </MonthlyPanelPreferencesProvider>
  );
};
