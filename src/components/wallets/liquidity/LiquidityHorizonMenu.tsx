'use client';

import { CalendarRange } from 'lucide-react';
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
  LIQUIDITY_HORIZON_OPTIONS,
  type LiquidityHorizonMonths,
} from '@/components/wallets/liquidity/liquidity-personalization';

type LiquidityHorizonMenuProps = {
  value: LiquidityHorizonMonths;
  onChange: (value: LiquidityHorizonMonths) => void;
};

export const LiquidityHorizonMenu = ({ value, onChange }: LiquidityHorizonMenuProps) => {
  const active = LIQUIDITY_HORIZON_OPTIONS.find((option) => option.value === value);

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
              aria-label="Elegir cuántos meses ver hacia adelante"
            >
              <CalendarRange className="size-3.5 shrink-0" aria-hidden />
              Ver {active?.label ?? `${value} meses`}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Cambia el horizonte de la proyección mes a mes
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Próximos meses</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={String(value)}
          onValueChange={(next) => onChange(Number(next) as LiquidityHorizonMonths)}
        >
          {LIQUIDITY_HORIZON_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={String(option.value)}>
              <span>{option.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{option.hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
