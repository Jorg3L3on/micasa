'use client';

import { AlertTriangle, CheckCircle2, FileText, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CreditCardCycleReconciliation } from '@/lib/finance/credit-card-cycle-reconciliation';
import type { CreditCardStatementImportListItem } from '@/types/catalog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type CreditCardReconciliationStripProps = {
  reconciliation: CreditCardCycleReconciliation;
  cycleDueDate: string;
  latestImport: CreditCardStatementImportListItem | null;
  onOpenImportDialog: () => void;
};

const statusConfig = {
  matched: {
    label: 'Cuadra',
    icon: CheckCircle2,
    tone: 'border-l-emerald-500/50 text-emerald-600 dark:text-emerald-400',
    message: 'La deuda registrada coincide con el cálculo del ciclo.',
  },
  minor_diff: {
    label: 'Diferencia menor',
    icon: Scale,
    tone: 'border-l-amber-500/50 text-amber-600 dark:text-amber-400',
    message: 'Hay una pequeña diferencia — revisa movimientos recientes.',
  },
  needs_review: {
    label: 'Revisar',
    icon: AlertTriangle,
    tone: 'border-l-destructive/50 text-destructive',
    message: 'La deuda registrada no coincide con el import o el ledger.',
  },
} as const;

export const CreditCardReconciliationStrip = ({
  reconciliation,
  cycleDueDate,
  latestImport,
  onOpenImportDialog,
}: CreditCardReconciliationStripProps) => {
  const config = statusConfig[reconciliation.status];
  const Icon = config.icon;

  return (
    <div
      role="region"
      aria-label="Conciliación del ciclo"
      className={cn(
        'rounded-2xl border border-border/60 border-l-[3px] bg-card px-4 py-3',
        config.tone.split(' ')[0],
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Icon className={cn('h-4 w-4 shrink-0', config.tone.split(' ').slice(1).join(' '))} aria-hidden />
            <p className="text-sm font-semibold">¿Cuadra?</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {config.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{config.message}</p>
          <dl className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Esperado</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {formatCurrency(reconciliation.expectedBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registrado</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {formatCurrency(reconciliation.registeredBalance)}
              </dd>
            </div>
            {Math.abs(reconciliation.delta) >= 1 ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Diferencia</dt>
                <dd className="font-mono font-semibold tabular-nums">
                  {reconciliation.delta >= 0 ? '+' : ''}
                  {formatCurrency(reconciliation.delta)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="shrink-0 space-y-2 text-right text-xs text-muted-foreground">
          <p>
            Vencimiento del ciclo:{' '}
            <span className="font-medium text-foreground">{formatDate(cycleDueDate)}</span>
          </p>
          {reconciliation.importedMinimumPayment != null ? (
            <p>
              Pago mínimo (PDF):{' '}
              <span className="font-mono font-medium text-foreground">
                {formatCurrency(reconciliation.importedMinimumPayment)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {latestImport ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <FileText className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
            <span className="truncate">
              Último import:{' '}
              {latestImport.period_start && latestImport.period_end
                ? `${formatDate(latestImport.period_start.slice(0, 10))} – ${formatDate(latestImport.period_end.slice(0, 10))}`
                : (latestImport.file_name ?? `#${latestImport.id}`)}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 rounded-lg px-2 text-xs"
            onClick={onOpenImportDialog}
          >
            Ver importaciones
          </Button>
        </div>
      ) : null}
    </div>
  );
};
