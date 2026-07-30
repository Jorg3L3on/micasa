'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { CategoryLabel } from '@/components/categories/CategoryLabel';

type ExpenseHealthCheckCardProps = {
  data: DashboardData;
};

export default function ExpenseHealthCheckCard({
  data,
}: ExpenseHealthCheckCardProps) {
  const { totalOverdueAmount, percentCommitted, largestExpense } =
    data.expenseHealth;

  const isHighCommitment = percentCommitted >= 80;

  return (
    <section
      className="flex flex-col rounded-xl border border-border/60 bg-card p-6"
      role="region"
      aria-label="Salud de gastos"
    >
      <div className="mb-5 flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">Salud de gastos</h3>
        <p className="text-xs text-muted-foreground">
          Compromiso, vencidos y mayor gasto del periodo
        </p>
      </div>

      <TooltipProvider>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Ingresos comprometidos
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className={cn(
                    'mt-1 cursor-help font-mono text-2xl font-medium tabular-nums',
                    isHighCommitment
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-foreground',
                  )}
                >
                  {percentCommitted.toFixed(1)}%
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left">
                Porcentaje del ingreso del periodo asignado a salidas de
                efectivo o débito (incluye pagos a tarjeta del periodo).
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">Total vencido</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="mt-1 cursor-help font-mono text-sm font-medium tabular-nums text-red-600 dark:text-red-400">
                  {formatCurrency(totalOverdueAmount)}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                Monto total de gastos con fecha de pago vencida
              </TooltipContent>
            </Tooltip>
          </div>

          {largestExpense && (
            <div>
              <p className="text-xs text-muted-foreground">Mayor gasto</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-1 cursor-help">
                    <p className="truncate text-sm font-medium text-foreground">
                      {largestExpense.description}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CategoryLabel
                        name={largestExpense.category}
                        icon={largestExpense.categoryIcon}
                      />
                      <span>·</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(largestExpense.amount)}
                      </span>
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Mayor gasto único en el periodo actual
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </TooltipProvider>
    </section>
  );
}
