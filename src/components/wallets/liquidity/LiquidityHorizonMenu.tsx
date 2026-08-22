'use client';

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
  LIQUIDITY_CHART_RANGE_OPTIONS,
  type LiquidityChartRangeId,
} from '@/components/wallets/liquidity/liquidity-personalization';

type LiquidityChartRangeMenuProps = {
  value: LiquidityChartRangeId;
  onChange: (value: LiquidityChartRangeId) => void;
  isLoading?: boolean;
};

export const LiquidityChartRangeMenu = ({
  value,
  onChange,
  isLoading = false,
}: LiquidityChartRangeMenuProps) => {
  const active = LIQUIDITY_CHART_RANGE_OPTIONS.find((option) => option.value === value);

  return (
    <DropdownMenu>
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
              {active?.label ?? 'Rango'}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Cambia qué meses muestra la gráfica
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Rango del gráfico</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as LiquidityChartRangeId)}
        >
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
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** @deprecated Use LiquidityChartRangeMenu */
export const LiquidityHorizonMenu = LiquidityChartRangeMenu;
