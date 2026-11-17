'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BudgetAdjustDialog } from '@/components/monthly/BudgetAdjustDialog';
import {
  isCalendarFortnightCurrent,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';
import type { BudgetQuincenaRef } from '@/lib/api/budgets';
import type { MonthlyBudgetScope } from '@/types/monthly-budget-panel';

export type BudgetAdjustTarget = {
  quincena: BudgetQuincenaRef;
  onSaved: () => Promise<void> | void;
};

/** Only the quincena in course or the next one can be adjusted (MIC-I19). */
export const canAdjustQuincena = (ref: BudgetQuincenaRef): boolean =>
  isCalendarFortnightCurrent(ref.year, ref.month, ref.period) ||
  isCalendarFortnightNext(ref.year, ref.month, ref.period);

/** "Ajustar esta quincena" under the budget rows; 44px on touch, 32px from sm (MIC-I11-6). */
export const BudgetAdjustButton = ({
  scope,
  target,
  ownerQuery,
  className,
}: {
  scope: MonthlyBudgetScope;
  target: BudgetAdjustTarget | null | undefined;
  ownerQuery: string;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  if (!target || scope.budgets.length === 0 || !canAdjustQuincena(target.quincena)) {
    return null;
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('h-11 gap-2 sm:h-8', className)}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Pencil className="h-4 w-4 shrink-0" aria-hidden />
        Ajustar esta quincena
      </Button>
      <BudgetAdjustDialog
        open={open}
        onOpenChange={setOpen}
        budgets={scope.budgets}
        quincena={target.quincena}
        onSaved={target.onSaved}
        ownerQuery={ownerQuery}
      />
    </>
  );
};
