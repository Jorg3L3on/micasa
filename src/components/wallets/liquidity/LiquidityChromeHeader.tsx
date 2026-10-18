'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Goal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MONTHLY_ICON_PILL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { formatMonthTitle } from '@/lib/calendar-dates';
import { formatShortMonthLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import { cn } from '@/lib/utils';

type LiquidityChromeHeaderProps = {
  /** Every projected month; stepping past the chart window widens it. */
  monthKeys: string[];
  selectedMonthKey: string;
  currentMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
};

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
  const label = targetLabel ? `${verb}: ${targetLabel}` : `${verb} (no hay más meses)`;

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
        {targetLabel ? `${verb} (${targetLabel})` : 'No hay más meses proyectados'}
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
            'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left',
            'transition-colors hover:bg-muted/20 dark:hover:bg-white/[0.04]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
          aria-label={`Elegir mes en detalle: ${monthName} ${year}`}
          aria-live="polite"
        >
          <span className={cn('hidden sm:flex', MONTHLY_ICON_PILL_CLASS)} aria-hidden>
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col items-center gap-0.5 sm:items-start">
            <span className="eyebrow text-muted-foreground">Mes en detalle</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {monthName}
                {year !== currentYear ? (
                  <span className="font-medium text-muted-foreground"> {year}</span>
                ) : null}
              </span>
              {isCurrent ? (
                <span className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 eyebrow text-foreground">
                  <span className="size-1.5 rounded-full bg-status-income" aria-hidden />
                  Actual
                </span>
              ) : null}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[17.5rem] p-2">
        <p className="mb-2 px-1 eyebrow text-muted-foreground">Meses proyectados</p>
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

/**
 * One job: pick the month whose detail shows under the chart. Chart range and
 * payoff progress live in the chart card (`LiquidityChartControls`).
 */
export const LiquidityChromeHeader = ({
  monthKeys,
  selectedMonthKey,
  currentMonthKey,
  onSelectMonth,
}: LiquidityChromeHeaderProps) => {
  const selectedIndex = monthKeys.indexOf(selectedMonthKey);
  const prevMonthKey = selectedIndex > 0 ? (monthKeys[selectedIndex - 1] ?? null) : null;
  const nextMonthKey =
    selectedIndex >= 0 && selectedIndex < monthKeys.length - 1
      ? (monthKeys[selectedIndex + 1] ?? null)
      : null;
  const canJumpToCurrent =
    selectedMonthKey !== currentMonthKey && monthKeys.includes(currentMonthKey);

  return (
    <div
      className="flex min-w-0 items-center gap-1"
      role="group"
      aria-label="Mes en detalle"
    >
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
      <div className="shrink-0">
        <MonthStepButton
          direction="next"
          targetMonthKey={nextMonthKey}
          onSelectMonth={onSelectMonth}
        />
      </div>
    </div>
  );
};
