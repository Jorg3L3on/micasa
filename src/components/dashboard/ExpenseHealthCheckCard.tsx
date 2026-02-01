import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';
import { AlertTriangle, Percent, TrendingUp } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';

type ExpenseHealthCheckCardProps = {
  data: DashboardData;
};

export default function ExpenseHealthCheckCard({
  data,
}: ExpenseHealthCheckCardProps) {
  const { totalOverdueAmount, percentCommitted, largestExpense } =
    data.expenseHealth;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Salud de gastos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              <span className="text-sm font-medium text-destructive">
                Total vencido
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="cursor-help">
                  {formatCurrency(totalOverdueAmount)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Monto total de gastos con fecha de pago vencida
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-muted-foreground">
                Ingresos comprometido
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant={percentCommitted >= 80 ? 'destructive' : 'secondary'}
                  className="cursor-help"
                >
                  {percentCommitted.toFixed(1)}%
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Porcentaje de ingresos del periodo asignado a gastos
              </TooltipContent>
            </Tooltip>
          </div>

          {largestExpense && (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <TrendingUp
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Mayor gasto
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right">
                    <p className="text-sm font-semibold truncate max-w-[140px]">
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
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
