'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type LiquidityMonthStepperProps = {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
};

export const LiquidityMonthStepper = ({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: LiquidityMonthStepperProps) => {
  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8"
            aria-label="Mes anterior"
            disabled={!canPrev}
            onClick={onPrev}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Mes anterior en la gráfica</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8"
            aria-label="Mes siguiente"
            disabled={!canNext}
            onClick={onNext}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Mes siguiente en la gráfica</TooltipContent>
      </Tooltip>
    </div>
  );
};
