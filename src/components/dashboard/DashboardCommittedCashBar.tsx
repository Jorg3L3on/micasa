'use client';

import { Banknote } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';

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
      className={cn(DASHBOARD_CARD_CLASS, 'min-h-0 p-4', className)}
      role="region"
      aria-label="Efectivo comprometido del periodo"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
          <Banknote
            className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-none">
            Efectivo del periodo
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Pagado, pendiente y disponible
          </p>
        </div>
      </div>

      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50"
        role="img"
        aria-label={`Pagado ${pagadoPct.toFixed(0)}%, pendiente ${pendientePct.toFixed(0)}%, disponible ${librePct.toFixed(0)}%`}
      >
        {pagadoPct > 0 ? (
          <div
            className="h-full rounded-l-full bg-green-500 dark:bg-green-400"
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
            className="h-full rounded-r-full bg-emerald-500 dark:bg-emerald-400"
            style={{ width: `${librePct}%` }}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          <span className="text-[9px] text-muted-foreground">Pagado</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[9px] text-muted-foreground">Pendiente</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] text-muted-foreground">Disponible</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-[3px] border-l-green-500/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pagado
          </span>
          <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-green-600 dark:text-green-400">
            {formatCurrency(pagado)}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-[3px] border-l-amber-500/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pendiente
          </span>
          <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {formatCurrency(pendiente)}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-[3px] border-l-emerald-500/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Disponible
          </span>
          <p
            className={cn(
              'mt-0.5 font-mono text-sm font-bold tabular-nums',
              libre < 0
                ? 'text-destructive'
                : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {formatCurrency(libre)}
          </p>
        </div>
      </div>
    </section>
  );
}
