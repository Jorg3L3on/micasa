'use client';

import type { ReactNode } from 'react';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { MonthlyChromeHeader } from '@/components/monthly/MonthlyChromeHeader';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import { cn } from '@/lib/utils';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelLayoutProps = {
  ownerKey: string;
  year: number;
  month: number;
  monthName: string;
  isCurrentMonth: boolean;
  currentMonthHref: string;
  todayYmd: string;
  suggestedPeriod: FortnightPeriod;
  ownerQuery: string;
  budgetPanel: MonthlyBudgetPanelResult;
  firstLabel: string;
  secondLabel: string;
  prevControl: ReactNode;
  nextControl: ReactNode;
  children: ReactNode;
};

export const MonthlyPanelLayout = ({
  ownerKey,
  year,
  month,
  monthName,
  isCurrentMonth,
  currentMonthHref,
  todayYmd,
  suggestedPeriod,
  ownerQuery,
  budgetPanel,
  firstLabel,
  secondLabel,
  prevControl,
  nextControl,
  children,
}: MonthlyPanelLayoutProps) => {
  return (
    <MonthlyPanelPreferencesProvider
      ownerKey={ownerKey}
      year={year}
      month={month}
      suggestedPeriod={suggestedPeriod}
    >
      <div className="mb-5 rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm sm:px-4">
        <MonthlyChromeHeader
          year={year}
          month={month}
          monthName={monthName}
          isCurrentMonth={isCurrentMonth}
          currentMonthHref={currentMonthHref}
          firstLabel={firstLabel}
          secondLabel={secondLabel}
          prevControl={prevControl}
          nextControl={nextControl}
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
        <div className="flex min-w-0 flex-col gap-5">
          <MonthlyBudgetSidebar
            panel={budgetPanel}
            ownerQuery={ownerQuery}
            year={year}
            month={month}
            todayYmd={todayYmd}
          />
        </div>
      </div>
    </MonthlyPanelPreferencesProvider>
  );
};
