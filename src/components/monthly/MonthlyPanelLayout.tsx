'use client';

import type { ReactNode } from 'react';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { MonthlyPanelHeaderActions } from '@/components/monthly/MonthlyPanelHeaderActions';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import { cn } from '@/lib/utils';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelLayoutProps = {
  ownerKey: string;
  year: number;
  month: number;
  suggestedPeriod: FortnightPeriod;
  ownerQuery: string;
  budgetPanel: MonthlyBudgetPanelResult;
  monthHeader: ReactNode;
  children: ReactNode;
};

const MonthlyPanelHeaderBridge = ({
  prevHref,
  nextHref,
  hasNextMonth,
  prevMonthLabel,
  nextMonthLabel,
}: {
  prevHref: string;
  nextHref: string | null;
  hasNextMonth: boolean;
  prevMonthLabel: string;
  nextMonthLabel: string;
}) => {
  const { summaryVisible, tableDensity, setSummaryVisible, setTableDensity } =
    useMonthlyPanelPreferences();

  return (
    <MonthlyPanelHeaderActions
      prevHref={prevHref}
      nextHref={nextHref}
      hasNextMonth={hasNextMonth}
      prevMonthLabel={prevMonthLabel}
      nextMonthLabel={nextMonthLabel}
      summaryVisible={summaryVisible}
      tableDensity={tableDensity}
      onSummaryVisibleChange={setSummaryVisible}
      onTableDensityChange={setTableDensity}
    />
  );
};

export const MonthlyPanelLayout = ({
  ownerKey,
  year,
  month,
  suggestedPeriod,
  ownerQuery,
  budgetPanel,
  monthHeader,
  children,
  prevHref,
  nextHref,
  hasNextMonth,
  prevMonthLabel,
  nextMonthLabel,
}: MonthlyPanelLayoutProps & {
  prevHref: string;
  nextHref: string | null;
  hasNextMonth: boolean;
  prevMonthLabel: string;
  nextMonthLabel: string;
}) => {
  return (
    <MonthlyPanelPreferencesProvider
      ownerKey={ownerKey}
      year={year}
      month={month}
      suggestedPeriod={suggestedPeriod}
    >
      <div
        className="mb-5 flex flex-col gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4"
        role="group"
        aria-label="Selector de mes"
      >
        {monthHeader}
        <MonthlyPanelHeaderBridge
          prevHref={prevHref}
          nextHref={nextHref}
          hasNextMonth={hasNextMonth}
          prevMonthLabel={prevMonthLabel}
          nextMonthLabel={nextMonthLabel}
        />
      </div>

      <div
        className={cn(
          'grid gap-6',
          'xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start',
        )}
      >
        <div className="mx-auto min-w-0 w-full max-w-4xl xl:max-w-none">
          {children}
        </div>
        <MonthlyBudgetSidebar panel={budgetPanel} ownerQuery={ownerQuery} />
      </div>
    </MonthlyPanelPreferencesProvider>
  );
};
