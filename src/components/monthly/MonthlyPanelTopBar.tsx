'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

/**
 * Spec: match Option 2 top chrome — glowing active month capsule in the
 * center, muted neighbor months, vivid quincena pills. Same strength as the
 * neon summary cards (do not dilute).
 */
const sideMonthClass =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium text-muted-foreground/80 transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 sm:min-w-24 sm:px-3';

const periodButtonClass = (active: boolean) =>
  cn(
    'inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-[11px] font-semibold transition-all duration-200 sm:text-xs',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50',
    active
      ? cn(
          'bg-violet-500/20 text-violet-200',
          'shadow-[0_0_0_1px_rgba(167,139,250,0.55),0_0_22px_rgba(139,92,246,0.45)]',
          'ring-1 ring-violet-400/70',
        )
      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
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
        'relative rounded-2xl border border-violet-500/35 bg-[#0c0c12] px-3 py-3',
        'shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_0_28px_rgba(139,92,246,0.22)]',
      )}
      role="group"
      aria-label="Selector de mes y quincena"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            {hasPrevMonth ? (
              <Link
                href={prevHref}
                className={cn(sideMonthClass, 'justify-self-start')}
                aria-label={`Ir al mes anterior: ${prevMonthLabel}`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden data-icon="inline-start" />
                <span className="hidden max-w-24 truncate sm:inline">{prevMonthLabel}</span>
              </Link>
            ) : (
              <span
                className={cn(sideMonthClass, 'pointer-events-none justify-self-start opacity-40')}
                aria-label={`Mes anterior: ${prevMonthLabel} (no disponible)`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden data-icon="inline-start" />
                <span className="hidden max-w-24 truncate sm:inline">{prevMonthLabel}</span>
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {hasPrevMonth
              ? `Ir al mes anterior (${prevMonthLabel})`
              : `${prevMonthLabel} (no disponible)`}
          </TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-col items-center gap-2.5">
          <div
            className={cn(
              'inline-flex min-w-0 max-w-full items-center gap-2 rounded-2xl px-4 py-2',
              'border-2 border-violet-400/90 bg-violet-500/10',
              'shadow-[0_0_0_1px_rgba(167,139,250,0.4),0_0_28px_rgba(139,92,246,0.55)]',
            )}
          >
            <h1 className="truncate text-base font-semibold leading-tight text-white sm:text-lg">
              {monthName} {year}
            </h1>
            {isCurrentMonth ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-emerald-400/60 bg-emerald-500/15 px-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Actual
              </span>
            ) : null}
          </div>

          <div
            className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1"
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
                className={cn(sideMonthClass, 'justify-self-end')}
                aria-label={`Ir al mes siguiente: ${nextMonthLabel}`}
              >
                <span className="hidden max-w-24 truncate sm:inline">{nextMonthLabel}</span>
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
