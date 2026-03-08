import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { AlertTriangle, Percent, Receipt } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

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
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base font-medium">Salud de gastos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider>
          <div className="flex flex-col items-center gap-1 pt-2 pb-2">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Percent className="size-3.5 shrink-0" aria-hidden />
              <span className="text-xs font-medium">Ingresos comprometidos</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className={cn(
                    'text-2xl font-semibold tracking-tight',
                    isHighCommitment ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {percentCommitted.toFixed(1)}%
                </p>
              </TooltipTrigger>
              <TooltipContent>
                Porcentaje de ingresos del periodo asignado a gastos
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                <span className="text-xs font-medium">Total vencido</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-base font-medium text-destructive cursor-help">
                    {formatCurrency(totalOverdueAmount)}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  Monto total de gastos con fecha de pago vencida
                </TooltipContent>
              </Tooltip>
            </div>

            {largestExpense && (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Receipt className="size-3.5 shrink-0" aria-hidden />
                  <span className="text-xs font-medium">Mayor gasto</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-sm font-medium truncate">
                        {largestExpense.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {largestExpense.category} ·{' '}
                        {formatCurrency(largestExpense.amount)}
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
