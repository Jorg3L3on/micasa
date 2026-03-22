import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';

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
    <Card className={DASHBOARD_CARD_CLASS} role="region" aria-label="Comparación de periodos">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
            <ArrowUpRight className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden />
          </span>
          <CardTitle className="text-sm font-semibold leading-none">
            Comparación de periodos
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            incomeUp ? 'border-l-blue-500/50' : 'border-l-destructive/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ingresos vs anterior
          </span>
          <p
            className={cn(
              'text-2xl font-bold font-mono tabular-nums mt-0.5',
              incomeUp ? 'text-blue-600 dark:text-blue-400' : 'text-destructive',
            )}
          >
            {incomeDiff >= 0 ? '+' : ''}
            {formatCurrency(incomeDiff)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
          <div
            className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-blue-500/50')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ingresos actual
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
              {formatCurrency(currentIncome)}
            </p>
          </div>
          <div
            className={cn(DASHBOARD_METRIC_STRIP_CLASS, 'border-l-violet-500/50')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gastos actual
            </span>
            <p className="text-sm font-bold font-mono tabular-nums text-violet-600 dark:text-violet-400 mt-0.5">
              {formatCurrency(currentExpense)}
            </p>
          </div>
        </div>

        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            expenseDown ? 'border-l-green-500/50' : 'border-l-destructive/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gastos vs anterior
          </span>
          <p
            className={cn(
              'text-sm font-bold font-mono tabular-nums mt-0.5',
              expenseDown ? 'text-green-600 dark:text-green-400' : 'text-destructive',
            )}
          >
            {expenseDiff >= 0 ? '+' : ''}
            {formatCurrency(expenseDiff)}
          </p>
        </div>

        <p
          className="text-[9px] text-muted-foreground border-t border-border/60 pt-3"
          aria-label="Periodo anterior"
        >
          Anterior: Ingresos {formatCurrency(previousIncome)}, Gastos{' '}
          {formatCurrency(previousExpense)}
        </p>
      </CardContent>
    </Card>
  );
}
