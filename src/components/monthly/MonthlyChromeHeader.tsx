'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Goal, Hourglass } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MonthlyMonthPicker } from '@/components/monthly/MonthlyMonthPicker';
import {
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_TRACK_CLASS,
  MONTHLY_ACCENT_TEXT_CLASS,
  MONTHLY_ICON_PILL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import { usePublishMonthlyHeaderPeriod } from '@/components/monthly/monthly-header-period';
import {
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

export const ChromeDivider = ({ className }: { className?: string }) => (
  <div
    className={cn(
      'hidden h-10 w-px shrink-0 bg-border/60 @min-[42rem]:block',
      className,
    )}
    aria-hidden
  />
);

const MONTH_SHORT_ES_LOWER = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const formatAxisDate = (ymd: string) => {
  const parts = ymd.split('-');
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day) return ymd;
  return `${day} ${MONTH_SHORT_ES_LOWER[month - 1] ?? ''}`;
};

export type ProgressTone = 'active' | 'complete' | 'upcoming';

export const chromeTileClass =
  'flex min-w-0 items-center gap-2.5 @min-[42rem]:flex-1 @min-[42rem]:px-3';

export const statusGlyphClass = (tone: ProgressTone) => {
  if (tone === 'active') return MONTHLY_ICON_PILL_CLASS;
  if (tone === 'complete') {
    return cn(
      'flex size-8 shrink-0 items-center justify-center rounded-xl',
      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    );
  }
  return cn(
    'flex size-8 shrink-0 items-center justify-center rounded-xl',
    'bg-muted/80 text-muted-foreground',
  );
};

export const FortnightProgressTrack = ({
  percent,
  tone,
  label,
}: {
  percent: number;
  tone: ProgressTone;
  label: string;
}) => {
  const showKnob = tone === 'active' && percent > 0;

  return (
    <div className="relative flex h-2.5 items-center">
      <div
        className="h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.08]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            'h-full rounded-full bg-linear-to-r from-primary to-status-info shadow-glow transition-[width] duration-500',
            tone === 'upcoming' && 'bg-none shadow-none',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showKnob ? (
        <span
          className="pointer-events-none absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-glow"
          style={{ left: `${Math.min(percent, 100)}%` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
};

type FortnightProgressStatusProps = {
  position: ReturnType<typeof getFortnightPeriodPosition>;
  todayYmd: string;
  startYmd: string;
  endYmd: string;
};

const FortnightProgressStatus = ({
  position,
  todayYmd,
  startYmd,
  endYmd,
}: FortnightProgressStatusProps) => {
  const tone: ProgressTone =
    position.kind === 'current'
      ? 'active'
      : position.kind === 'past'
        ? 'complete'
        : 'upcoming';

  const percent =
    position.kind === 'current'
      ? position.elapsedPercent
      : position.kind === 'past'
        ? 100
        : 0;

  const StatusIcon =
    tone === 'active'
      ? Hourglass
      : tone === 'complete'
        ? CheckCircle2
        : CalendarClock;

  const progressLabel =
    position.kind === 'current'
      ? `Progreso de la quincena: ${percent}%`
      : position.kind === 'past'
        ? 'Quincena terminada'
        : 'Quincena aún no empieza';

  const title =
    position.kind === 'past'
      ? 'Terminada'
      : position.kind === 'future'
        ? `Empieza ${formatAxisDate(startYmd)}`
        : position.remainingDays <= 1
          ? 'Último día'
          : `${position.remainingDays} días`;

  const titleSr =
    position.kind === 'current' && position.remainingDays > 1
      ? `Faltan ${position.remainingDays} días`
      : title;

  const leftDate =
    position.kind === 'current'
      ? formatAxisDate(todayYmd)
      : formatAxisDate(startYmd);

  return (
    <div className={chromeTileClass} aria-live="polite">
      <span
        className={cn(
          'flex @min-[42rem]:hidden @min-[62rem]:flex',
          statusGlyphClass(tone),
        )}
        aria-hidden
      >
        <StatusIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className="min-w-0 truncate text-sm font-semibold leading-tight tracking-tight"
            aria-label={titleSr}
          >
            {position.kind === 'current' && position.remainingDays > 1 ? (
              <span className="tabular-nums">{title}</span>
            ) : (
              title
            )}
          </p>
          {tone === 'upcoming' ? (
            <span className="shrink-0 rounded-full border border-border/50 px-2 py-0.5 overline text-muted-foreground">
              Próxima
            </span>
          ) : (
            <span
              className={cn(
                'shrink-0 text-sm font-semibold tabular-nums',
                MONTHLY_ACCENT_TEXT_CLASS,
              )}
            >
              {percent}%
            </span>
          )}
        </div>
        <FortnightProgressTrack
          percent={percent}
          tone={tone}
          label={progressLabel}
        />
        <div className="flex items-center justify-between gap-2 text-caption leading-none text-muted-foreground sm:text-caption">
          <span className={cn('min-w-0 truncate', accentEmphasisClass)}>
            {leftDate}
          </span>
          <span className={cn('shrink-0', accentEmphasisClass)}>
            {formatAxisDate(endYmd)}
          </span>
        </div>
      </div>
    </div>
  );
};

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
  usePublishMonthlyHeaderPeriod(showFortnightToggle ? period : null);
  const current = getCalendarFortnightRefForYmd(todayYmd);
  const currentYear = current.year;
  const currentMonth = current.month;
  const isCurrentFortnight =
    isCurrentMonth && (!showFortnightToggle || period === current.period);

  const handlePeriodChange = (next: FortnightPeriod) => {
    setPeriod(next);
  };

  const position = getFortnightPeriodPosition(year, month, period, todayYmd);
  const bounds = getFortnightCalendarBounds(year, month, period);

  const fortnightToggle = !showFortnightToggle ? null : !prefsReady ? (
    <Skeleton
      className="h-9 w-full rounded-2xl @min-[42rem]:w-[13.5rem]"
      aria-hidden
    />
  ) : (
    <Tabs
      value={period}
      onValueChange={(next) => {
        if (next === 'FIRST' || next === 'SECOND') handlePeriodChange(next);
      }}
      variant="pill"
      className="w-full @min-[42rem]:w-auto"
    >
      <TabsList
        aria-label="Quincena"
        wrapperClassName="w-full @min-[42rem]:w-auto"
        className={cn(
          'w-full gap-0.5 rounded-2xl border border-border/40 p-0.5 shadow-inner @min-[42rem]:w-max',
          GLASS_TAB_TRACK_CLASS,
        )}
      >
        <TabsTrigger
          value="FIRST"
          stretch
          aria-label={`Primera quincena: ${firstLabel}`}
          title={firstLabel}
          indicatorClassName={AURA_TAB_INDICATOR_CLASS}
          activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
          className="min-h-8 px-2 py-1.5 text-xs font-semibold leading-none @min-[42rem]:px-2.5"
        >
          1ª Quincena
        </TabsTrigger>
        <TabsTrigger
          value="SECOND"
          stretch
          aria-label={`Segunda quincena: ${secondLabel}`}
          title={secondLabel}
          indicatorClassName={AURA_TAB_INDICATOR_CLASS}
          activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
          className="min-h-8 px-2 py-1.5 text-xs font-semibold leading-none @min-[42rem]:px-2.5"
        >
          2ª Quincena
        </TabsTrigger>
      </TabsList>
    </Tabs>
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

  const progressCenter = (
    <FortnightProgressStatus
      position={position}
      todayYmd={todayYmd}
      startYmd={bounds.startYmd}
      endYmd={bounds.endYmd}
    />
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

          <MonthlyMonthPicker
            year={year}
            month={month}
            monthName={monthName}
            ownerQuery={ownerQuery}
            currentYear={currentYear}
            currentMonth={currentMonth}
            showCurrentBadge={isCurrentFortnight}
          />
          {jumpToCurrent}

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

          <div className="min-w-0 @min-[42rem]:flex-1">
            {progressCenter}
          </div>

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
