'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

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
    <section
      className="flex flex-col rounded-xl border border-border/60 bg-card p-6"
      role="region"
      aria-label="Comparación de periodos"
    >
      <div className="mb-5 flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">
          Comparación de periodos
        </h3>
        <p className="text-xs text-muted-foreground">
          Diferencias vs el periodo anterior
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
              {formatCurrency(currentIncome)}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {incomeUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />
              )}
              <span
                className={cn(
                  'font-mono tabular-nums',
                  incomeUp
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {incomeDiff >= 0 ? '+' : ''}
                {formatCurrency(incomeDiff)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
              {formatCurrency(currentExpense)}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {expenseDown ? (
                <TrendingDown className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden />
              ) : (
                <TrendingUp className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />
              )}
              <span
                className={cn(
                  'font-mono tabular-nums',
                  expenseDown
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {expenseDiff >= 0 ? '+' : ''}
                {formatCurrency(expenseDiff)}
              </span>
            </div>
          </div>
        </div>

        <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Anterior: {formatCurrency(previousIncome)} ingresos,{' '}
          {formatCurrency(previousExpense)} gastos
        </p>
      </div>
    </section>
  );
}
