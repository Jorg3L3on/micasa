'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Goal, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MonthlyMonthPicker } from '@/components/monthly/MonthlyMonthPicker';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import {
  formatDayMonthLabel,
  formatDayMonthLabelFromYmd,
  getFortnightCalendarBounds,
  getFortnightPeriodPosition,
} from '@/lib/fortnight-calendar';
import { cn } from '@/lib/utils';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyChromeHeaderProps = {
  year: number;
  month: number;
  monthName: string;
  isCurrentMonth: boolean;
  /** Href for jumping back to the calendar current month; only used when not current. */
  currentMonthHref: string;
  todayYmd: string;
  ownerQuery: string;
  firstLabel: string;
  secondLabel: string;
  prevControl: ReactNode;
  nextControl: ReactNode;
  /** When false, hide fortnight toggle (e.g. month not created yet). */
  showFortnightToggle?: boolean;
};

const fortnightSegmentClass = (active: boolean) =>
  cn(
    'relative min-h-8 flex-1 cursor-pointer rounded-md px-2 py-1.5 text-xs font-semibold leading-none transition-colors md:flex-none md:px-2.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active
      ? 'bg-primary text-primary-foreground shadow-sm'
      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground active:scale-[0.98]',
  );

const ChromeDivider = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'hidden h-10 w-px shrink-0 bg-border/60 md:block',
      className,
    )}
    aria-hidden
  />
);

export const MonthlyChromeHeader = ({
  year,
  month,
  monthName,
  isCurrentMonth,
  currentMonthHref,
  todayYmd,
  ownerQuery,
  firstLabel,
  secondLabel,
  prevControl,
  nextControl,
  showFortnightToggle = true,
}: MonthlyChromeHeaderProps) => {
  const { prefsReady, period, setPeriod } = useMonthlyPanelPreferences();
  const [currentYear, currentMonth] = todayYmd.split('-').map(Number) as [
    number,
    number,
  ];

  const handlePeriodChange = (next: FortnightPeriod) => {
    setPeriod(next);
  };

  const position = getFortnightPeriodPosition(year, month, period, todayYmd);
  const bounds = getFortnightCalendarBounds(year, month, period);
  const startLabel = formatDayMonthLabel(year, month, bounds.startDay);
  const endLabel = formatDayMonthLabel(year, month, bounds.endDay);

  const fortnightToggle = !showFortnightToggle ? null : !prefsReady ? (
    <Skeleton className="h-9 w-full rounded-lg md:w-[13.5rem]" aria-hidden />
  ) : (
    <div
      className="flex w-full items-center gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5 shadow-sm dark:bg-muted/25 md:inline-flex md:w-auto"
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
        1ª Quincena
      </button>
      <button
        type="button"
        onClick={() => handlePeriodChange('SECOND')}
        className={fortnightSegmentClass(period === 'SECOND')}
        aria-pressed={period === 'SECOND'}
        aria-label={`Segunda quincena: ${secondLabel}`}
        title={secondLabel}
      >
        2ª Quincena
      </button>
    </div>
  );

  const jumpToCurrent = !isCurrentMonth ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground md:h-7 md:w-7"
          asChild
        >
          <Link href={currentMonthHref} aria-label="Ir al mes actual">
            <Goal className="size-5 shrink-0 md:size-3.5" aria-hidden />
            <span className="sr-only">Ir al mes actual</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        Ir al mes actual
      </TooltipContent>
    </Tooltip>
  ) : null;

  const remainingLabel =
    position.kind === 'current' ? (
      position.remainingDays <= 1 ? (
        <span className="font-medium text-primary">Último día</span>
      ) : (
        <span>
          Faltan{' '}
          <span className="font-medium text-primary">
            {position.remainingDays} días
          </span>
        </span>
      )
    ) : null;

  const progressCenter =
    position.kind === 'current' ? (
      <div
        className="flex min-w-0 flex-1 flex-col gap-1 md:gap-1.5 md:px-3"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
          <span className="min-w-0 truncate">
            Hoy es{' '}
            <span className="font-medium text-primary">
              {formatDayMonthLabelFromYmd(todayYmd)}
            </span>
          </span>
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <Hourglass className="size-3 shrink-0 opacity-70" aria-hidden />
            {remainingLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50"
            role="progressbar"
            aria-valuenow={position.elapsedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso de la quincena: ${position.elapsedPercent}%`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${position.elapsedPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
            {position.elapsedPercent}%
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Termina el{' '}
          <span className="font-medium text-primary">{endLabel}</span>
        </p>
      </div>
    ) : (
      <div
        className="flex min-w-0 flex-1 flex-col justify-center gap-1 md:gap-1.5 md:px-3"
        aria-live="polite"
      >
        <p className="text-[11px] text-muted-foreground sm:text-xs">
          {position.kind === 'past' ? (
            'Quincena terminada'
          ) : (
            <>
              Empieza el{' '}
              <span className="font-medium text-foreground">{startLabel}</span>
            </>
          )}
        </p>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40 md:max-w-xs"
          role="progressbar"
          aria-valuenow={position.kind === 'past' ? 100 : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            position.kind === 'past'
              ? 'Quincena terminada'
              : 'Quincena aún no empieza'
          }
        >
          <div
            className="h-full rounded-full bg-muted-foreground/25"
            style={{ width: position.kind === 'past' ? '100%' : '0%' }}
          />
        </div>
      </div>
    );

  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 md:flex-row md:items-center md:gap-0"
      role="group"
      aria-label="Selector de mes y quincena"
    >
      {/* Month row: prev · month module · next (mobile / tablet) */}
      <div className="flex min-w-0 items-center gap-1">
        <div className="shrink-0">{prevControl}</div>

        <div
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 md:flex-none md:justify-start md:gap-1.5"
          aria-live="polite"
        >
          <div className="flex min-w-0 flex-col items-center gap-0.5 md:items-start">
            <div className="flex min-w-0 items-center gap-1">
              <MonthlyMonthPicker
                year={year}
                month={month}
                monthName={monthName}
                ownerQuery={ownerQuery}
                currentYear={currentYear}
                currentMonth={currentMonth}
              />
              {jumpToCurrent}
            </div>
            {isCurrentMonth ? (
              <span
                className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                aria-label="Mes actual"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                  aria-hidden
                />
                Actual
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 md:hidden">{nextControl}</div>
      </div>

      <div
        className="h-px w-full bg-border/50 md:hidden"
        aria-hidden
      />

      <ChromeDivider className="mx-2" />

      {/* Progress */}
      <div className="min-w-0 md:flex-1">{progressCenter}</div>

      <div
        className="h-px w-full bg-border/50 md:hidden"
        aria-hidden
      />

      <ChromeDivider className="mx-2" />

      {/* Toggle + next (desktop) */}
      <div className="flex w-full shrink-0 items-center gap-2 md:w-auto md:justify-end">
        {showFortnightToggle ? fortnightToggle : null}
        <div className="hidden shrink-0 md:block">{nextControl}</div>
      </div>
    </div>
  );
};
