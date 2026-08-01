'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import { cn } from '@/lib/utils';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyChromeHeaderProps = {
  year: number;
  month: number;
  monthName: string;
  isCurrentMonth: boolean;
  /** Href for jumping back to the calendar current month; only used when not current. */
  currentMonthHref: string;
  firstLabel: string;
  secondLabel: string;
  prevControl: ReactNode;
  nextControl: ReactNode;
  /** When false, hide fortnight toggle (e.g. month not created yet). */
  showFortnightToggle?: boolean;
};

const fortnightSegmentClass = (active: boolean) =>
  cn(
    'relative min-h-8 min-w-12 shrink-0 cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-semibold leading-none transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground active:scale-[0.98]',
  );

export const MonthlyChromeHeader = ({
  year,
  month,
  monthName,
  isCurrentMonth,
  currentMonthHref,
  firstLabel,
  secondLabel,
  prevControl,
  nextControl,
  showFortnightToggle = true,
}: MonthlyChromeHeaderProps) => {
  const { prefsReady, period, setPeriod } = useMonthlyPanelPreferences();
  const monthLastDay = new Date(year, month, 0).getDate();
  const firstRange = '1–15';
  const secondRange = `16–${monthLastDay}`;

  const handlePeriodChange = (next: FortnightPeriod) => {
    setPeriod(next);
  };

  const fortnightToggle = !showFortnightToggle ? null : !prefsReady ? (
    <Skeleton className="h-9 w-[10.5rem] rounded-lg" aria-hidden />
  ) : (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-sm dark:bg-muted/25"
      role="group"
      aria-label="Quincena"
    >
      <button
        type="button"
        onClick={() => handlePeriodChange('FIRST')}
        className={fortnightSegmentClass(period === 'FIRST')}
        aria-pressed={period === 'FIRST'}
        aria-label={`Primera quincena: ${firstLabel}`}
        title={firstLabel}
      >
        <span className="tabular-nums">1ª</span>
        <span className="ml-1 hidden text-[11px] font-medium opacity-80 sm:inline">
          {firstRange}
        </span>
      </button>
      <button
        type="button"
        onClick={() => handlePeriodChange('SECOND')}
        className={fortnightSegmentClass(period === 'SECOND')}
        aria-pressed={period === 'SECOND'}
        aria-label={`Segunda quincena: ${secondLabel}`}
        title={secondLabel}
      >
        <span className="tabular-nums">2ª</span>
        <span className="ml-1 hidden text-[11px] font-medium opacity-80 sm:inline">
          {secondRange}
        </span>
      </button>
    </div>
  );

  const jumpToCurrent = !isCurrentMonth ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={currentMonthHref} aria-label="Ir al mes actual">
            <Calendar className="size-4 shrink-0" aria-hidden data-icon="inline-start" />
            <span className="sr-only">Ir al mes actual</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        Ir al mes actual
      </TooltipContent>
    </Tooltip>
  ) : null;

  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 sm:gap-0"
      role="group"
      aria-label="Selector de mes y quincena"
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <div className="shrink-0">{prevControl}</div>

        <div
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:justify-start sm:gap-2 sm:pl-1"
          aria-live="polite"
        >
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
            {monthName}{' '}
            <span className="font-medium text-muted-foreground">{year}</span>
          </h1>
          {isCurrentMonth ? (
            <span
              className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300"
              aria-label="Mes actual"
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                aria-hidden
              />
              Actual
            </span>
          ) : (
            jumpToCurrent
          )}
        </div>

        <div className="hidden shrink-0 sm:block">{fortnightToggle}</div>
        <div className="shrink-0">{nextControl}</div>
      </div>

      {showFortnightToggle ? (
        <div className="flex justify-center sm:hidden">{fortnightToggle}</div>
      ) : null}
    </div>
  );
};
