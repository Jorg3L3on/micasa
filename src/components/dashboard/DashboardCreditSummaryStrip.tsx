'use client';

import { CreditCard } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { DASHBOARD_CARD_CLASS, DASHBOARD_METRIC_STRIP_CLASS } from './constants';

type DashboardCreditSummaryStripProps = {
  creditWalletDebtTotal: number;
  creditWalletAvailableTotal: number;
  className?: string;
};

export default function DashboardCreditSummaryStrip({
  creditWalletDebtTotal,
  creditWalletAvailableTotal,
  className,
}: DashboardCreditSummaryStripProps) {
  return (
    <section
      className={cn(DASHBOARD_CARD_CLASS, 'min-h-0 p-4', className)}
      role="region"
      aria-label="Resumen de crédito"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
          <CreditCard
            className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
            aria-hidden
          />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-none">Crédito</h3>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Deuda y disponible en tarjetas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-[3px] border-l-violet-500/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deuda usada
          </span>
          <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-violet-600 dark:text-violet-400">
            {formatCurrency(creditWalletDebtTotal)}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'border-l-[3px] border-l-sky-500/50',
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Crédito disponible
          </span>
          <p className="mt-0.5 font-mono text-sm font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {formatCurrency(creditWalletAvailableTotal)}
          </p>
        </div>
      </div>
    </section>
  );
}
