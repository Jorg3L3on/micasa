'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelTopBarProps = {
  year: number;
  month: number;
  monthName: string;
  isCurrentMonth: boolean;
  hasPrevMonth: boolean;
  prevHref: string;
  prevMonthLabel: string;
  hasNextMonth: boolean;
  nextHref: string;
  nextMonthLabel: string;
  firstLabel: string;
  secondLabel: string;
  nextFallbackAction?: ReactNode;
};

const navButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/80 text-muted-foreground shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/35 hover:bg-muted/45 hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45';

const periodButtonClass = (active: boolean) =>
  cn(
    'inline-flex h-8 items-center justify-center rounded-lg px-3 text-[11px] font-semibold transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
    active
      ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30'
      : 'text-muted-foreground hover:bg-background hover:text-foreground',
  );

export function MonthlyPanelTopBar({
  year,
  month,
  monthName,
  isCurrentMonth,
  hasPrevMonth,
  prevHref,
  prevMonthLabel,
  hasNextMonth,
  nextHref,
  nextMonthLabel,
  firstLabel,
  secondLabel,
  nextFallbackAction,
}: MonthlyPanelTopBarProps) {
  const { prefsReady, period, setPeriod } = useMonthlyPanelPreferences();
  const monthLastDay = new Date(year, month, 0).getDate();

  const handlePeriodChange = (nextPeriod: FortnightPeriod) => {
    setPeriod(nextPeriod);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card/95 px-3 py-2.5 shadow-sm',
        'before:pointer-events-none before:absolute before:inset-x-1/3 before:top-0 before:h-px before:bg-primary/45',
        'dark:bg-card/80 dark:shadow-primary/5',
      )}
      role="group"
      aria-label="Selector de mes y quincena"
    >
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            {hasPrevMonth ? (
              <Link
                href={prevHref}
                className={cn(navButtonClass, 'justify-self-start')}
                aria-label={`Ir al mes anterior: ${prevMonthLabel}`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden data-icon="inline-start" />
                <span className="sr-only">Ir a {prevMonthLabel}</span>
              </Link>
            ) : (
              <span
                className={cn(navButtonClass, 'pointer-events-none justify-self-start opacity-45')}
                aria-label={`Mes anterior: ${prevMonthLabel} (no disponible)`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden data-icon="inline-start" />
                <span className="sr-only">{prevMonthLabel}</span>
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {hasPrevMonth
              ? `Ir al mes anterior (${prevMonthLabel})`
              : `${prevMonthLabel} (no disponible)`}
          </TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-col items-center gap-1.5">
          <div className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-primary/35 bg-background/70 px-3 py-1.5 shadow-sm shadow-primary/10 ring-1 ring-primary/10">
            <CalendarDays
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden
              data-icon="inline-start"
            />
            <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
              {monthName} {year}
            </h1>
            {isCurrentMonth ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Actual
              </span>
            ) : null}
          </div>

          <div
            className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1"
            role="group"
            aria-label="Cambiar quincena"
          >
            <button
              type="button"
              className={periodButtonClass(prefsReady && period === 'FIRST')}
              onClick={() => handlePeriodChange('FIRST')}
              disabled={!prefsReady}
              aria-pressed={prefsReady && period === 'FIRST'}
              aria-label={`Primera quincena: ${firstLabel}`}
              title={firstLabel}
            >
              1ª quincena · 1–15
            </button>
            <button
              type="button"
              className={periodButtonClass(prefsReady && period === 'SECOND')}
              onClick={() => handlePeriodChange('SECOND')}
              disabled={!prefsReady}
              aria-pressed={prefsReady && period === 'SECOND'}
              aria-label={`Segunda quincena: ${secondLabel}`}
              title={secondLabel}
            >
              2ª quincena · 16–{monthLastDay}
            </button>
          </div>
        </div>

        {hasNextMonth ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={nextHref}
                className={cn(navButtonClass, 'justify-self-end')}
                aria-label={`Ir al mes siguiente: ${nextMonthLabel}`}
              >
                <span className="sr-only">Ir a {nextMonthLabel}</span>
                <ChevronRight className="h-4 w-4" aria-hidden data-icon="inline-end" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {`Ir al mes siguiente (${nextMonthLabel})`}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="justify-self-end">{nextFallbackAction}</div>
        )}
      </div>
    </div>
  );
}
