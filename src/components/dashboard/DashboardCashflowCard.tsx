'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

type DashboardCashflowCardProps = {
  totalIncome: number;
  totalPaid: number;
  className?: string;
};

export default function DashboardCashflowCard({
  totalIncome,
  totalPaid,
  className,
}: DashboardCashflowCardProps) {
  const disponible = totalIncome - totalPaid;
  const isPositive = disponible >= 0;

  return (
    <section
      className={cn(
        'flex flex-col justify-between rounded-xl border border-border/60 bg-card p-6',
        className,
      )}
      role="region"
      aria-label="Flujo del periodo"
    >
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">
          Flujo del periodo
        </h3>
        <p className="text-xs text-muted-foreground">
          Solo gastos ya pagados
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="mt-1 truncate font-mono text-base font-medium tabular-nums text-foreground">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Gastos pagados</p>
          <p className="mt-1 truncate font-mono text-base font-medium tabular-nums text-foreground">
            {formatCurrency(totalPaid)}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Disponible</p>
          <div className="mt-1 flex items-center gap-1">
            {isPositive ? (
              <TrendingUp
                className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
                aria-hidden
              />
            ) : (
              <TrendingDown
                className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden
              />
            )}
            <p
              className={cn(
                'truncate font-mono text-base font-medium tabular-nums',
                isPositive
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400',
              )}
            >
              {formatCurrency(disponible)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
