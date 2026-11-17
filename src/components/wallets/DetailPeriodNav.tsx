'use client';

import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type DetailPeriodNavProps = {
  /** Small line above the period, such as "Mes actual". */
  eyebrow: string;
  label: string;
  previousLabel: string;
  nextLabel: string;
  resetLabel: string;
  canGoNext: boolean;
  showReset: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onReset: () => void;
};

const ARROW_CLASS = 'size-11 shrink-0 rounded-full sm:size-9';

/** Month or statement cycle stepper shared by the wallet and card detail pages. */
export const DetailPeriodNav = ({
  eyebrow,
  label,
  previousLabel,
  nextLabel,
  resetLabel,
  canGoNext,
  showReset,
  onPrevious,
  onNext,
  onReset,
}: DetailPeriodNavProps) => (
  <div className="flex items-center gap-2">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={ARROW_CLASS}
          onClick={onPrevious}
          aria-label={previousLabel}
        >
          <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{previousLabel}</TooltipContent>
    </Tooltip>
    <div className="min-w-0 flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 text-center dark:bg-muted/10">
      <p className="eyebrow text-muted-foreground">{eyebrow}</p>
      <p className="truncate text-xs font-semibold tabular-nums sm:text-sm" title={label}>
        {label}
      </p>
    </div>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={ARROW_CLASS}
          onClick={onNext}
          disabled={!canGoNext}
          aria-label={nextLabel}
        >
          <ChevronRight className="h-4 w-4" data-icon="inline-end" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{nextLabel}</TooltipContent>
    </Tooltip>
    {showReset ? (
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0 rounded-full px-2.5 text-caption sm:min-h-9"
        onClick={onReset}
        aria-label={resetLabel}
      >
        <RotateCcw className="mr-1 h-3 w-3" aria-hidden data-icon="inline-start" />
        Hoy
      </Button>
    ) : null}
  </div>
);
