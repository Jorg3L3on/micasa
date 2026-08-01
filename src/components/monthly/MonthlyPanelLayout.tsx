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
      <div
        className={cn(
          'relative mb-5 overflow-hidden rounded-xl border border-sky-500/20 px-2.5 py-2.5 shadow-sm sm:px-4 sm:py-3',
          'bg-gradient-to-br from-sky-500/8 via-card to-sky-500/2',
          'dark:from-sky-500/14 dark:via-card/60 dark:to-sky-500/4',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px',
          'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
        )}
      >
        <MonthlyChromeHeader
          year={year}
          month={month}
          monthName={monthName}
          isCurrentMonth={isCurrentMonth}
          currentMonthHref={currentMonthHref}
          todayYmd={todayYmd}
          ownerQuery={ownerQuery}
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
