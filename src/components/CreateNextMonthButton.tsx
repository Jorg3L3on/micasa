'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { createMonthFortnights } from '@/lib/api/fortnights';

type CreateNextMonthButtonProps = {
  nextYear: number;
  nextMonth: number;
  nextMonthLabel: string;
  canCreate: boolean;
};

export default function CreateNextMonthButton({
  nextYear,
  nextMonth,
  nextMonthLabel,
  canCreate,
}: CreateNextMonthButtonProps) {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!canCreate || submitting) return;
    try {
      setSubmitting(true);
      const result = await createMonthFortnights(nextYear, nextMonth, context);
      const totalExp = result.expensesCreated?.total ?? 0;
      const totalInc = result.incomeCreated?.total ?? 0;
      const parts: string[] = [];
      if (totalExp > 0) parts.push(`${totalExp} gasto(s)`);
      if (totalInc > 0) parts.push(`${totalInc} ingreso(s)`);
      if (parts.length > 0) {
        toast.success(`Mes ${nextMonthLabel} creado. ${parts.join(', ')}`);
      } else {
        toast.success(`Mes ${nextMonthLabel} creado`);
      }
      const monthPadded = String(nextMonth).padStart(2, '0');
      router.push(`/monthly/${nextYear}/${monthPadded}${queryString ? `?${queryString}` : ''}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear el mes';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreate) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCreate}
      disabled={submitting}
      aria-busy={submitting}
      aria-label={`Crear planificación para ${nextMonthLabel}`}
      className={cn(
        'h-auto min-h-9 shrink-0 justify-start gap-2.5 whitespace-normal rounded-xl border-border/60 py-2 pl-2 pr-3',
        'bg-card text-left shadow-sm transition-all',
        'hover:border-violet-500/40 hover:shadow-md dark:bg-card/80',
        'focus-visible:ring-violet-500/20 dark:focus-visible:ring-violet-500/30',
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15"
        aria-hidden
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
        ) : (
          <CalendarPlus className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        )}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
          {submitting ? 'Creando…' : 'Nuevo mes'}
        </span>
        <span className="text-sm font-semibold leading-tight text-foreground">
          {nextMonthLabel}
        </span>
      </span>
    </Button>
  );
}
