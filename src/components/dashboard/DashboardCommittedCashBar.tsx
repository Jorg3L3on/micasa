'use client';

import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type DashboardCommittedCashBarProps = {
  availableVsCommitted: DashboardData['availableVsCommitted'];
  className?: string;
};

export default function DashboardCommittedCashBar({
  availableVsCommitted,
  className,
}: DashboardCommittedCashBarProps) {
  const { pagado, pendiente, libre } = availableVsCommitted;
  const total = Math.max(pagado + pendiente + Math.max(libre, 0), 0);
  const pagadoPct = total > 0 ? (pagado / total) * 100 : 0;
  const pendientePct = total > 0 ? (pendiente / total) * 100 : 0;
  const librePct = total > 0 ? (Math.max(libre, 0) / total) * 100 : 0;

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border/60 bg-card p-6',
        className,
      )}
      role="region"
      aria-label="Efectivo del periodo"
    >
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">
          Efectivo del periodo
        </h3>
        <p className="text-xs text-muted-foreground">
          Pagado, pendiente y disponible proyectado
        </p>
      </div>

      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted/50"
        role="img"
        aria-label={`Pagado ${pagadoPct.toFixed(0)}%, pendiente ${pendientePct.toFixed(0)}%, disponible proyectado ${librePct.toFixed(0)}%`}
      >
        {pagadoPct > 0 ? (
          <div
            className="h-full bg-green-500 dark:bg-green-400 first:rounded-l-full"
            style={{ width: `${pagadoPct}%` }}
          />
        ) : null}
        {pendientePct > 0 ? (
          <div
            className="h-full bg-amber-400 dark:bg-amber-500"
            style={{ width: `${pendientePct}%` }}
          />
        ) : null}
        {librePct > 0 ? (
          <div
            className="h-full bg-emerald-500 dark:bg-emerald-400 last:rounded-r-full"
            style={{ width: `${librePct}%` }}
          />
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Pagado</span>
          </div>
          <p className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
            {formatCurrency(pagado)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs text-muted-foreground">Pendiente</span>
          </div>
          <p className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
            {formatCurrency(pendiente)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              Disp. proyectado
            </span>
          </div>
          <p
            className={cn(
              'mt-1 font-mono text-sm font-medium tabular-nums',
              libre < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground',
            )}
          >
            {formatCurrency(libre)}
          </p>
        </div>
      </div>
    </section>
  );
}
