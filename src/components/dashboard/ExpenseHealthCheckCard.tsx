import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { Percent } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';
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
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Salud de gastos">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <Percent className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Salud de gastos
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider>
          <div
            className={cn(
              DASHBOARD_METRIC_STRIP_CLASS,
              isHighCommitment
                ? 'border-l-destructive/50'
                : 'border-l-violet-500/50',
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ingresos comprometidos
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className={cn(
                    'text-2xl font-bold font-mono tabular-nums mt-0.5 cursor-help',
                    isHighCommitment ? 'text-destructive' : 'text-violet-600 dark:text-violet-400',
                  )}
                >
                  {percentCommitted.toFixed(1)}%
                </p>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left">
                Porcentaje del ingreso del periodo ya asignado a salidas de efectivo
                o débito (incluye pagos a tarjeta registrados en el periodo). No
                incluye solo cargos a la tarjeta sin pagar el estado de cuenta.
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div
              className={cn(
                DASHBOARD_METRIC_STRIP_CLASS,
                'border-l-destructive/50',
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total vencido
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-bold font-mono tabular-nums text-destructive mt-0.5 cursor-help">
                    {formatCurrency(totalOverdueAmount)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  Monto total de gastos con fecha de pago vencida
                </TooltipContent>
              </Tooltip>
            </div>

            {largestExpense && (
              <div
                className={cn(
                  DASHBOARD_METRIC_STRIP_CLASS,
                  'border-l-violet-500/50',
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mayor gasto
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help mt-0.5">
                      <p className="text-sm font-medium truncate">
                        {largestExpense.description}
                      </p>
                      <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <CategoryLabel
                          name={largestExpense.category}
                          icon={largestExpense.categoryIcon}
                        />
                        <span className="text-muted-foreground/30">·</span>
                        <span>{formatCurrency(largestExpense.amount)}</span>
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
      </CardContent>
    </Card>
  );
}
