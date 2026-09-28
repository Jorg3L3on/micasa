'use client';

import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Goal,
  TrendingDown,
} from 'lucide-react';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChromeDivider,
  chromeTileClass,
  FortnightProgressTrack,
  statusGlyphClass,
} from '@/components/monthly/MonthlyChromeHeader';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  GLASS_TAB_TRACK_CLASS,
  MONTHLY_ACCENT_TEXT_CLASS,
  MONTHLY_ICON_PILL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { formatMonthTitle } from '@/lib/calendar-dates';
import {
  formatShortMonthLabel,
  LIQUIDITY_CHART_RANGE_OPTIONS,
  type LiquidityChartRangeId,
} from '@/components/wallets/liquidity/liquidity-personalization';
import type { LiquidityPayoffProgress } from '@/components/wallets/liquidity/liquidity-payoff-progress';
import { cn } from '@/lib/utils';

type LiquidityChromeHeaderProps = {
  /** Months drawn in the chart; the chrome steps and picks within them. */
  monthKeys: string[];
  selectedMonthKey: string;
  currentMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  chartRange: LiquidityChartRangeId;
  onChartRangeChange: (range: LiquidityChartRangeId) => void;
  payoff: LiquidityPayoffProgress | null;
};

const accentEmphasisClass = cn('font-semibold', MONTHLY_ACCENT_TEXT_CLASS);

const parseMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year: year ?? 0, month: month ?? 1 };
};

const formatMonthName = (monthKey: string): string => {
  const { month } = parseMonthKey(monthKey);
  return formatMonthTitle(month);
};

type MonthStepButtonProps = {
  direction: 'prev' | 'next';
  targetMonthKey: string | null;
  onSelectMonth: (monthKey: string) => void;
};

const MonthStepButton = ({ direction, targetMonthKey, onSelectMonth }: MonthStepButtonProps) => {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  const verb = direction === 'prev' ? 'Ir al mes anterior' : 'Ir al mes siguiente';
  const targetLabel = targetMonthKey ? formatMonthName(targetMonthKey) : null;
  const label = targetLabel ? `${verb}: ${targetLabel}` : `${verb} (fuera del rango)`;

  const handleClick = () => {
    if (targetMonthKey) onSelectMonth(targetMonthKey);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            disabled={!targetMonthKey}
            onClick={handleClick}
            aria-label={label}
          >
            <Icon className="size-5 shrink-0" strokeWidth={2.25} aria-hidden />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {targetLabel ? `${verb} (${targetLabel})` : 'Amplía el rango para ver más meses'}
      </TooltipContent>
    </Tooltip>
  );
};

type LiquidityMonthPickerProps = {
  monthKeys: string[];
  selectedMonthKey: string;
  currentMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
};

const LiquidityMonthPicker = ({
  monthKeys,
  selectedMonthKey,
  currentMonthKey,
  onSelectMonth,
}: LiquidityMonthPickerProps) => {
  const [open, setOpen] = useState(false);
  const { year } = parseMonthKey(selectedMonthKey);
  const currentYear = parseMonthKey(currentMonthKey).year;
  const monthName = formatMonthName(selectedMonthKey);
  const isCurrent = selectedMonthKey === currentMonthKey;

  const handleSelect = (monthKey: string) => {
    setOpen(false);
    onSelectMonth(monthKey);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-2.5 py-1.5 text-left',
            'transition-colors hover:bg-muted/20 dark:hover:bg-white/[0.04]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            '@min-[42rem]:flex-none @min-[42rem]:justify-start',
          )}
          aria-label={`Elegir mes: ${monthName} ${year}`}
          aria-live="polite"
        >
          <span className={cn('hidden sm:flex', MONTHLY_ICON_PILL_CLASS)} aria-hidden>
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col items-center gap-0.5 @min-[42rem]:items-start">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {monthName}
                {year !== currentYear ? (
                  <span className="font-medium text-muted-foreground"> {year}</span>
                ) : null}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </span>
            {isCurrent ? (
              <span className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 eyebrow text-foreground">
                <span
                  className="size-1.5 rounded-full bg-status-income"
                  aria-hidden
                />
                Actual
              </span>
            ) : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[17.5rem] p-2">
        <p className="mb-2 px-1 eyebrow text-muted-foreground">
          Meses en la gráfica
        </p>
        <div className="grid grid-cols-3 gap-1" role="listbox" aria-label="Meses">
          {monthKeys.map((monthKey) => {
            const isSelected = monthKey === selectedMonthKey;
            const isCalendarCurrent = monthKey === currentMonthKey;
            return (
              <DropdownMenuItem
                key={monthKey}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'justify-center rounded-md px-2 py-2 text-xs font-semibold capitalize',
                  isSelected &&
                    'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                  !isSelected &&
                    isCalendarCurrent &&
                    'border border-status-income/40 text-status-income',
                )}
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelect(monthKey);
                }}
              >
                {formatShortMonthLabel(monthKey)}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const PayoffProgressStatus = ({ payoff }: { payoff: LiquidityPayoffProgress }) => {
  const StatusIcon = payoff.tone === 'complete' ? CheckCircle2 : TrendingDown;

  return (
    <div className={chromeTileClass} aria-live="polite">
      <span
        className={cn('flex @min-[42rem]:hidden @min-[62rem]:flex', statusGlyphClass(payoff.tone))}
        aria-hidden
      >
        <StatusIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold leading-tight tracking-tight">
            {payoff.title}
          </p>
          <span
            className={cn('shrink-0 text-sm font-semibold tabular-nums', MONTHLY_ACCENT_TEXT_CLASS)}
          >
            {payoff.percent}%
          </span>
        </div>
        <FortnightProgressTrack
          percent={payoff.percent}
          tone={payoff.tone}
          label={`Deuda de hoy pagada al cierre del mes: ${payoff.percent}%`}
        />
        <div className="flex items-center justify-between gap-2 text-caption leading-none text-muted-foreground sm:text-caption">
          <span className={cn('min-w-0 truncate', accentEmphasisClass)}>{payoff.startLabel}</span>
          <span className={cn('shrink-0', accentEmphasisClass)}>
            {payoff.payoffInHorizon ? payoff.endLabel : `${payoff.endLabel}+`}
          </span>
        </div>
      </div>
    </div>
  );
};

type RangeToggleProps = {
  chartRange: LiquidityChartRangeId;
  onChartRangeChange: (range: LiquidityChartRangeId) => void;
};

const RangeToggle = ({ chartRange, onChartRangeChange }: RangeToggleProps) => {
  const handleValueChange = (next: string) => {
    const option = LIQUIDITY_CHART_RANGE_OPTIONS.find((item) => item.value === next);
    if (option) onChartRangeChange(option.value);
  };

  return (
    <SegmentedControl
      value={chartRange}
      onValueChange={handleValueChange}
      ariaLabel="Meses que muestra la gráfica"
      stretch
      className="w-full @min-[42rem]:w-auto @min-[42rem]:shrink-0"
      wrapperClassName="w-full @min-[42rem]:w-auto @min-[42rem]:min-w-60"
      listClassName={cn(
        'w-full gap-0.5 rounded-2xl border border-border/40 p-0.5 shadow-inner @min-[42rem]:w-max',
        GLASS_TAB_TRACK_CLASS,
      )}
      indicatorClassName={AURA_TAB_INDICATOR_CLASS}
      activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
      triggerClassName="px-2 py-1.5 text-xs font-semibold leading-none @min-[42rem]:px-2.5"
      options={LIQUIDITY_CHART_RANGE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        ariaLabel: option.description,
        title: option.description,
      }))}
    />
  );
};

export const LiquidityChromeHeader = ({
  monthKeys,
  selectedMonthKey,
  currentMonthKey,
  onSelectMonth,
  chartRange,
  onChartRangeChange,
  payoff,
}: LiquidityChromeHeaderProps) => {
  const selectedIndex = monthKeys.indexOf(selectedMonthKey);
  const prevMonthKey = selectedIndex > 0 ? (monthKeys[selectedIndex - 1] ?? null) : null;
  const nextMonthKey =
    selectedIndex >= 0 && selectedIndex < monthKeys.length - 1
      ? (monthKeys[selectedIndex + 1] ?? null)
      : null;
  const canJumpToCurrent =
    selectedMonthKey !== currentMonthKey && monthKeys.includes(currentMonthKey);

  const nextControl = (
    <MonthStepButton direction="next" targetMonthKey={nextMonthKey} onSelectMonth={onSelectMonth} />
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 @min-[42rem]:flex-row @min-[42rem]:items-center @min-[42rem]:gap-0"
      role="group"
      aria-label="Selector de mes y rango de la gráfica"
    >
      <div className="flex min-w-0 items-center gap-1">
        <div className="shrink-0">
          <MonthStepButton
            direction="prev"
            targetMonthKey={prevMonthKey}
            onSelectMonth={onSelectMonth}
          />
        </div>
        <LiquidityMonthPicker
          monthKeys={monthKeys}
          selectedMonthKey={selectedMonthKey}
          currentMonthKey={currentMonthKey}
          onSelectMonth={onSelectMonth}
        />
        {canJumpToCurrent ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground md:h-7 md:w-7"
                aria-label="Ir al mes actual"
                onClick={() => onSelectMonth(currentMonthKey)}
              >
                <Goal className="size-5 shrink-0 md:size-3.5" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Ir al mes actual
            </TooltipContent>
          </Tooltip>
        ) : null}
        <div className="shrink-0 @min-[42rem]:hidden">{nextControl}</div>
      </div>

      {payoff ? (
        <>
          <div className="h-px w-full bg-border/50 @min-[42rem]:hidden" aria-hidden />
          <ChromeDivider className="mx-2" />
          <div className="min-w-0 @min-[42rem]:flex-1">
            <PayoffProgressStatus payoff={payoff} />
          </div>
        </>
      ) : null}

      <div className="h-px w-full bg-border/50 @min-[42rem]:hidden" aria-hidden />
      <ChromeDivider className="mx-2" />

      <div className="flex w-full shrink-0 items-center gap-2 @min-[42rem]:w-auto @min-[42rem]:justify-end">
        <RangeToggle chartRange={chartRange} onChartRangeChange={onChartRangeChange} />
        <div className="hidden shrink-0 @min-[42rem]:flex">{nextControl}</div>
      </div>
    </div>
  );
};
