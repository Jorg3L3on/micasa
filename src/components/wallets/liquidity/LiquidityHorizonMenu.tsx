'use client';

import type { ChangeEvent, PointerEvent } from 'react';
import { CalendarRange, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  formatCustomChartRangeLabel,
  formatMonthYearLabel,
  LIQUIDITY_CHART_RANGE_OPTIONS,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { defaultCustomChartRange } from '@/lib/finance/liquidity-chart-range';
import { cn } from '@/lib/utils';

type LiquidityChartRangeMenuProps = {
  value: LiquidityChartRangeId;
  onChange: (value: LiquidityChartRangeId) => void;
  customRange: LiquidityCustomChartRange | null;
  onCustomRangeChange: (range: LiquidityCustomChartRange) => void;
  availableMonthKeys: readonly string[];
  asOfYmd: string;
  isLoading?: boolean;
};

const MonthSelect = ({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (monthKey: string) => void;
  disabled?: boolean;
}) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  const handleSelectPointerDown = (event: PointerEvent<HTMLSelectElement>) => {
    event.stopPropagation();
  };

  return (
    <label htmlFor={id} className="grid min-w-0 gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        id={id}
        value={options.includes(value) ? value : (options[0] ?? '')}
        onChange={handleChange}
        disabled={disabled || options.length === 0}
        aria-label={label}
        className={cn(
          'h-8 w-full rounded-md border border-border/60 bg-transparent px-2 text-xs text-foreground',
          'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        onPointerDown={handleSelectPointerDown}
      >
        {options.map((monthKey) => (
          <option key={monthKey} value={monthKey}>
            {formatMonthYearLabel(monthKey)}
          </option>
        ))}
      </select>
    </label>
  );
};

export const LiquidityChartRangeMenu = ({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
  availableMonthKeys,
  asOfYmd,
  isLoading = false,
}: LiquidityChartRangeMenuProps) => {
  const activePreset = LIQUIDITY_CHART_RANGE_OPTIONS.find((option) => option.value === value);
  const customLabel =
    value === 'custom' && customRange
      ? formatCustomChartRangeLabel(customRange.fromMonthKey, customRange.toMonthKey)
      : null;
  const triggerLabel = customLabel ?? activePreset?.label ?? 'Rango';
  const fromValue = customRange?.fromMonthKey ?? availableMonthKeys[0] ?? '';
  const toValue =
    customRange?.toMonthKey ?? availableMonthKeys[availableMonthKeys.length - 1] ?? '';

  const handlePresetChange = (next: string) => {
    if (next === 'custom') {
      onCustomRangeChange(
        customRange ?? defaultCustomChartRange(asOfYmd, availableMonthKeys),
      );
      return;
    }
    onChange(next as LiquidityChartRangeId);
  };

  const handleFromChange = (fromMonthKey: string) => {
    const toMonthKey =
      toValue && toValue < fromMonthKey ? fromMonthKey : toValue || fromMonthKey;
    onCustomRangeChange({ fromMonthKey, toMonthKey });
  };

  const handleToChange = (toMonthKey: string) => {
    const fromMonthKey =
      fromValue && fromValue > toMonthKey ? toMonthKey : fromValue || toMonthKey;
    onCustomRangeChange({ fromMonthKey, toMonthKey });
  };

  const handleCustomPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleCustomSelect = (event: Event) => {
    event.preventDefault();
  };

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              disabled={isLoading}
              aria-busy={isLoading}
              aria-label={
                isLoading
                  ? 'Actualizando rango del gráfico de deudas'
                  : 'Elegir rango del gráfico de deudas'
              }
            >
              {isLoading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <CalendarRange className="size-3.5 shrink-0" aria-hidden />
              )}
              {triggerLabel}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Cambia qué meses muestra la gráfica
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Rango del gráfico</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={handlePresetChange}>
          {LIQUIDITY_CHART_RANGE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              disabled={isLoading}
            >
              <span>{option.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{option.hint}</span>
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem
            value="custom"
            disabled={isLoading || availableMonthKeys.length === 0}
            onSelect={handleCustomSelect}
          >
            <span>Personalizado</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Mes a mes</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <div
          className="grid grid-cols-2 gap-2 px-2 pb-2 pt-1"
          onPointerDown={handleCustomPointerDown}
        >
          <MonthSelect
            id="liquidity-chart-range-from"
            label="Desde"
            value={fromValue}
            options={availableMonthKeys}
            onChange={handleFromChange}
            disabled={isLoading}
          />
          <MonthSelect
            id="liquidity-chart-range-to"
            label="Hasta"
            value={toValue}
            options={availableMonthKeys}
            onChange={handleToChange}
            disabled={isLoading}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** @deprecated Use LiquidityChartRangeMenu */
export const LiquidityHorizonMenu = LiquidityChartRangeMenu;
