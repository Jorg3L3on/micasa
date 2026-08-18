'use client';

import type { ReactNode } from 'react';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyChromeHeader } from '@/components/monthly/MonthlyChromeHeader';
import { MonthlyWelcome } from '@/components/monthly/MonthlyWelcome';
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
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

      <div
        className={cn(
          '@container',
          MONTHLY_PANEL_SHELL_CLASS,
          MONTHLY_CHROME_PADDING_CLASS,
          'mb-5',
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
          nextNavControl={nextNavControl}
          createNextControl={createNextControl}
        />
      </div>

      {children}
    </MonthlyPanelPreferencesProvider>
  );
};

export const MONTHLY_PANEL_CONTENT_GRID_CLASS =
  'grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start';

export const MONTHLY_PANEL_MAIN_COLUMN_CLASS =
  'mx-auto min-w-0 w-full max-w-4xl xl:max-w-none';

export const MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS =
  'hidden min-w-0 flex-col gap-5 xl:flex';
