import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, TrendingDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS } from './constants';

type PeriodComparisonCardProps = {
  data: DashboardData;
};

export default function PeriodComparisonCard({
  data,
}: PeriodComparisonCardProps) {
  const {
    currentIncome,
    currentExpense,
    previousIncome,
    previousExpense,
    incomeDiff,
    expenseDiff,
  } = data.periodComparison;

  const incomeUp = incomeDiff >= 0;
  const expenseDown = expenseDiff <= 0;

  return (
    <Card className={DASHBOARD_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Comparación de periodos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-1 pt-2 pb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {incomeUp ? (
              <ArrowUpRight
                className="size-3.5 shrink-0 text-chart-4"
                aria-hidden
              />
            ) : (
              <ArrowDownRight
                className="size-3.5 shrink-0 text-destructive"
                aria-hidden
              />
            )}
            <span className="text-xs font-medium">Ingresos vs anterior</span>
          </div>
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight',
              incomeUp ? 'text-chart-4' : 'text-destructive',
            )}
          >
            {incomeDiff >= 0 ? '+' : ''}
            {formatCurrency(incomeDiff)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-xs font-medium">Ingresos actual</span>
            </div>
            <p className="text-base font-medium text-chart-4 tabular-nums">
              {formatCurrency(currentIncome)}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="text-xs font-medium">Gastos actual</span>
            </div>
            <p className="text-base font-medium text-destructive tabular-nums">
              {formatCurrency(currentExpense)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-border/60 pt-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingDown className="size-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">Gastos vs anterior</span>
          </div>
          <p
            className={cn(
              'text-base font-medium',
              expenseDown ? 'text-chart-4' : 'text-destructive',
            )}
          >
            {expenseDiff >= 0 ? '+' : ''}
            {formatCurrency(expenseDiff)}
          </p>
        </div>

        <p
          className="text-xs text-muted-foreground border-t border-border/60 pt-3"
          aria-label="Periodo anterior"
        >
          Anterior: Ingresos {formatCurrency(previousIncome)}, Gastos{' '}
          {formatCurrency(previousExpense)}
        </p>
      </CardContent>
    </Card>
  );
}
