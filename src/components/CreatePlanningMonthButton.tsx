'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { createMonthFortnights } from '@/lib/api/fortnights';

type CreatePlanningMonthButtonProps = {
  year: number;
  month: number;
  monthLabel: string;
  canCreate: boolean;
  variant?: 'compact' | 'hero';
};

export default function CreatePlanningMonthButton({
  year,
  month,
  monthLabel,
  canCreate,
  variant = 'compact',
}: CreatePlanningMonthButtonProps) {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!canCreate || submitting) return;
    try {
      setSubmitting(true);
      const result = await createMonthFortnights(year, month, context);
      const totalExp = result.expensesCreated?.total ?? 0;
      const totalInc = result.incomeCreated?.total ?? 0;
      const parts: string[] = [];
      if (totalExp > 0) parts.push(`${totalExp} gasto(s)`);
      if (totalInc > 0) parts.push(`${totalInc} ingreso(s)`);
      if (parts.length > 0) {
        toast.success(`Mes ${monthLabel} creado. ${parts.join(', ')}`);
      } else {
        toast.success(`Mes ${monthLabel} creado`);
      }
      const monthPadded = String(month).padStart(2, '0');
      router.push(`/monthly/${year}/${monthPadded}${queryString ? `?${queryString}` : ''}`);
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
      variant={variant === 'hero' ? 'default' : 'outline'}
      size="sm"
      onClick={handleCreate}
      disabled={submitting}
      aria-busy={submitting}
      aria-label={`Crear planificación para ${monthLabel}`}
      className={cn(
        'h-auto min-h-9 shrink-0 justify-start gap-2.5 whitespace-normal',
        variant === 'compact'
          ? 'rounded-xl border-border/60 bg-card py-2 pl-2 pr-3 text-left shadow-sm transition-all hover:border-violet-500/40 hover:shadow-md dark:bg-card/80'
          : 'rounded-lg px-4 py-2',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          variant === 'compact'
            ? 'bg-violet-500/10 dark:bg-violet-500/15'
            : 'bg-primary-foreground/15',
        )}
        aria-hidden
      >
        {submitting ? (
          <Loader2
            className={cn(
              'h-4 w-4 animate-spin',
              variant === 'compact' && 'text-violet-600 dark:text-violet-400',
            )}
          />
        ) : (
          <CalendarPlus
            className={cn(
              'h-4 w-4',
              variant === 'compact' && 'text-violet-600 dark:text-violet-400',
            )}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider leading-none',
            variant === 'compact'
              ? 'text-muted-foreground'
              : 'text-primary-foreground/80',
          )}
        >
          {submitting ? 'Creando...' : 'Crear mes'}
        </span>
        <span
          className={cn(
            'text-sm font-semibold leading-tight',
            variant === 'compact' ? 'text-foreground' : 'text-primary-foreground',
          )}
        >
          {monthLabel}
        </span>
      </span>
    </Button>
  );
}
