'use client';

import { BarChart3 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatWallClockDateRange } from '@/lib/calendar-dates';
import BudgetPeriodDetail from '@/components/BudgetPeriodDetail';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';
import type { BudgetPeriodItem } from '@/types/catalog';
import type { FinanceContextType } from '@/types/finance-context';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: BudgetPeriodItem | null;
  context: FinanceContextType;
};

export default function BudgetPeriodDetailDialog({
  open,
  onOpenChange,
  period,
  context,
}: Props) {
  if (!period) return null;

  const overspent = period.remaining_amount < 0;
  const frequencyLabel =
    BUDGET_FREQUENCY_LABELS[period.frequency as BudgetFrequency] ?? period.frequency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-4 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-3 px-6 pt-6">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-500/15">
              <BarChart3
                className="h-4 w-4 text-sky-600 dark:text-sky-400"
                aria-hidden
              />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base leading-tight">
                <span className="truncate">{period.name}</span>
                {overspent ? (
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    Excedido
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                  {frequencyLabel}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1">
                {formatWallClockDateRange(period.start_date, period.end_date)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <BudgetPeriodDetail period={period} context={context} active={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
