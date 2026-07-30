'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Check } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { updateExpensePaidStatus } from '@/lib/api/transactions';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import type { DashboardData } from '@/types/dashboard';

type UpcomingObligationsCardProps = {
  data: DashboardData;
};

export default function UpcomingObligationsCard({
  data,
}: UpcomingObligationsCardProps) {
  const router = useRouter();
  const { context } = useFinanceContext();
  const todayYmd = useHydrationSafeTodayYmd();
  const obligations = data.upcomingObligations.filter(
    (ob) => ob.source === 'expense',
  );

  const totalPendiente = obligations.reduce((sum, ob) => sum + ob.amount, 0);

  const handleMarkPaid = async (
    e: React.MouseEvent,
    obligation: DashboardData['upcomingObligations'][number],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await updateExpensePaidStatus(obligation.id, true, context);
      router.refresh();
    } catch (err) {
      console.error('Failed to mark as paid:', err);
    }
  };

  return (
    <section
      className="flex flex-col rounded-xl border border-border/60 bg-card p-6"
      role="region"
      aria-label="Próximos gastos"
    >
      <div className="mb-5 flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">Próximos gastos</h3>
        <p className="text-xs text-muted-foreground">
          {obligations.length > 0
            ? `${obligations.length} pendiente${obligations.length === 1 ? '' : 's'} · ${formatCurrency(totalPendiente)}`
            : 'Sin gastos pendientes en este periodo'}
        </p>
      </div>

      {obligations.length === 0 ? (
        <p className="flex-1 py-6 text-center text-xs text-muted-foreground">
          Todo al día.
        </p>
      ) : (
        <TooltipProvider>
          <ul className="space-y-1.5" role="list">
            {obligations.map((ob) => {
              const overdue = ob.dueDate < todayYmd;
              return (
                <li
                  key={`${ob.source}-${ob.id}`}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40',
                    overdue && 'bg-red-500/5',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {ob.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ob.dueDate)}
                      {overdue && (
                        <span className="ml-1.5 text-red-600 dark:text-red-400">
                          · Vencido
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                      {formatCurrency(ob.amount)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => handleMarkPaid(e, ob)}
                          aria-label={`Marcar ${ob.description} como pagado`}
                        >
                          <Check
                            className="h-4 w-4 text-green-600 dark:text-green-400"
                            aria-hidden
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Marcar como pagado</TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </TooltipProvider>
      )}
    </section>
  );
}
