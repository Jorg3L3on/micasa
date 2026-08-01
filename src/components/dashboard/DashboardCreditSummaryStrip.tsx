'use client';

import { cn, formatCurrency } from '@/lib/utils';

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
      className={cn(
        'flex flex-col justify-between rounded-xl border border-border/60 bg-card p-6',
        className,
      )}
      role="region"
      aria-label="Resumen de crédito"
    >
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 className="text-sm font-medium text-foreground">Crédito</h3>
        <p className="text-xs text-muted-foreground">
          Deuda y disponible en tarjetas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Deuda usada</p>
          <p className="mt-1 font-mono text-base font-medium tabular-nums text-foreground">
            {formatCurrency(creditWalletDebtTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Crédito disponible</p>
          <p className="mt-1 font-mono text-base font-medium tabular-nums text-foreground">
            {formatCurrency(creditWalletAvailableTotal)}
          </p>
        </div>
      </div>
    </section>
  );
}
