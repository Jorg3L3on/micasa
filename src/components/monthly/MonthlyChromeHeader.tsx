'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDays, Goal, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MonthlyMonthPicker } from '@/components/monthly/MonthlyMonthPicker';
import { MONTHLY_ACCENT_TEXT_CLASS } from '@/components/monthly/monthly-panel-shell';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import {
  formatDayMonthLabelFromYmd,
  getCalendarFortnightRefForYmd,
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
  /** Chevron next when the next month already exists. */
  nextNavControl?: ReactNode;
  /** Compact “Crear mes” CTA when the next month can be created. */
  createNextControl?: ReactNode;
  /** When false, hide fortnight toggle and progress (e.g. month not created yet). */
  showFortnightToggle?: boolean;
};

const accentEmphasisClass = cn('font-semibold', MONTHLY_ACCENT_TEXT_CLASS);

const fortnightSegmentClass = (active: boolean) =>
  cn(
    'relative min-h-8 flex-1 cursor-pointer rounded-full px-2 py-1.5 text-xs font-semibold leading-none transition-all @min-[42rem]:flex-none @min-[42rem]:px-2.5',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active
      ? 'bg-linear-to-r from-[#FF5733] to-[#FF2E00] text-white shadow-[0_8px_20px_-10px_rgba(255,87,51,0.75)]'
      : 'text-foreground/70 hover:text-foreground/90 active:scale-[0.98]',
  );

const ChromeDivider = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'hidden h-10 w-px shrink-0 bg-border/60 @min-[42rem]:block',
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
  nextNavControl = null,
  createNextControl = null,
  showFortnightToggle = true,
}: MonthlyChromeHeaderProps) => {
  const { prefsReady, period, setPeriod } = useMonthlyPanelPreferences();
  const current = getCalendarFortnightRefForYmd(todayYmd);
  const currentYear = current.year;
  const currentMonth = current.month;

  const handlePeriodChange = (next: FortnightPeriod) => {
    setPeriod(next);
  };

  const position = getFortnightPeriodPosition(year, month, period, todayYmd);
  const bounds = getFortnightCalendarBounds(year, month, period);
  const startLabel = formatDayMonthLabelFromYmd(bounds.startYmd);
  const endLabel = formatDayMonthLabelFromYmd(bounds.endYmd);

  const fortnightToggle = !showFortnightToggle ? null : !prefsReady ? (
    <Skeleton
      className="h-9 w-full rounded-2xl @min-[42rem]:w-[13.5rem]"
      aria-hidden
    />
  ) : (
    <div
      className={cn(
        'flex w-full items-center gap-0.5 rounded-2xl border border-border/40 p-0.5 shadow-inner @min-[42rem]:inline-flex @min-[42rem]:w-auto',
        'bg-gradient-to-br from-muted/30 via-background to-muted/10',
        'dark:from-muted/20 dark:via-card dark:to-muted/5',
      )}
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
        <span className={accentEmphasisClass}>Último día</span>
      ) : (
        <span>
          Faltan{' '}
          <span className={accentEmphasisClass}>
            {position.remainingDays} días
          </span>
        </span>
      )
    ) : null;

  const progressCenter =
    position.kind === 'current' ? (
      <div
        className="flex min-w-0 flex-col gap-1 @min-[42rem]:flex-1 @min-[42rem]:gap-1.5 @min-[42rem]:px-3"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
          <span>
            Hoy es{' '}
            <span className={accentEmphasisClass}>
              {formatDayMonthLabelFromYmd(todayYmd)}
            </span>
          </span>
          <span className="text-border/80" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1">
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
              className="h-full rounded-full bg-linear-to-r from-[#3a37fc] to-[#ee477a] transition-[width] duration-500"
              style={{ width: `${position.elapsedPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
            {position.elapsedPercent}%
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Termina el <span className={accentEmphasisClass}>{endLabel}</span>
        </p>
      </div>
    ) : (
      <div
        className="flex min-w-0 flex-col justify-center gap-1 @min-[42rem]:flex-1 @min-[42rem]:gap-1.5 @min-[42rem]:px-3"
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
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40 @min-[42rem]:max-w-xs"
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

  const desktopNextSlot =
    nextNavControl || createNextControl ? (
      <div className="hidden shrink-0 items-center gap-2 @min-[42rem]:flex">
        {nextNavControl}
        {createNextControl}
      </div>
    ) : null;

  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 @min-[42rem]:flex-row @min-[42rem]:items-center @min-[42rem]:gap-0"
      role="group"
      aria-label="Selector de mes y quincena"
    >
      {/* Month row: prev · month module · next nav (narrow containers) */}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <div className="shrink-0">{prevControl}</div>

          <div
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-2.5 py-1.5 dark:border-white/[0.08] dark:bg-white/[0.03] @min-[42rem]:flex-none @min-[42rem]:justify-start"
            aria-live="polite"
          >
            <span
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 shadow-sm ring-1 ring-primary/30 dark:bg-primary/20 dark:ring-[#911efe]/40 sm:flex"
              aria-hidden
            >
              <CalendarDays className={cn('h-4 w-4', MONTHLY_ACCENT_TEXT_CLASS)} />
            </span>
            <div className="flex min-w-0 flex-col items-center gap-0.5 @min-[42rem]:items-start">
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
                  className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 text-[10px] font-semibold uppercase tracking-wider text-primary dark:border-[#911efe]/40 dark:bg-[#911efe]/15 dark:text-[#d8b4fe]"
                  aria-label="Mes actual"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-[#ee477a]"
                    aria-hidden
                  />
                  Actual
                </span>
              ) : null}
            </div>
          </div>

          {nextNavControl ? (
            <div className="shrink-0 @min-[42rem]:hidden">{nextNavControl}</div>
          ) : null}
        </div>

        {/* Create CTA on its own narrow-container row so it never covers Goal / picker */}
        {createNextControl ? (
          <div className="flex justify-end @min-[42rem]:hidden">
            {createNextControl}
          </div>
        ) : null}
      </div>

      {showFortnightToggle ? (
        <>
          <div
            className="h-px w-full bg-border/50 @min-[42rem]:hidden"
            aria-hidden
          />

          <ChromeDivider className="mx-2" />

          {/* Progress */}
          <div className="min-w-0 @min-[42rem]:flex-1">{progressCenter}</div>

          <div
            className="h-px w-full bg-border/50 @min-[42rem]:hidden"
            aria-hidden
          />

          <ChromeDivider className="mx-2" />

          {/* Toggle + next (wide containers) */}
          <div className="flex w-full shrink-0 items-center gap-2 @min-[42rem]:w-auto @min-[42rem]:justify-end">
            {fortnightToggle}
            {desktopNextSlot}
          </div>
        </>
      ) : (
        desktopNextSlot
      )}
    </div>
  );
};
