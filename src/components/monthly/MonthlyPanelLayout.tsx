'use client';

import type { ReactNode } from 'react';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { MonthlyChromeHeader } from '@/components/monthly/MonthlyChromeHeader';
import { MonthlyWelcome } from '@/components/monthly/MonthlyWelcome';
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
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
  nextNavControl?: ReactNode;
  createNextControl?: ReactNode;
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
  nextNavControl = null,
  createNextControl = null,
  children,
}: MonthlyPanelLayoutProps) => {
  return (
    <MonthlyPanelPreferencesProvider
      ownerKey={ownerKey}
      year={year}
      month={month}
      suggestedPeriod={suggestedPeriod}
    >
      <MonthlyWelcome />

      <div className={cn('@container', MONTHLY_PANEL_SHELL_CLASS, MONTHLY_CHROME_PADDING_CLASS, 'mb-5')}>
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
          nextNavControl={nextNavControl}
          createNextControl={createNextControl}
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
        <div className="hidden min-w-0 flex-col gap-5 xl:flex">
          <MonthlyBudgetSidebar
            panel={budgetPanel}
            ownerQuery={ownerQuery}
          />
        </div>
      </div>
    </MonthlyPanelPreferencesProvider>
  );
};
