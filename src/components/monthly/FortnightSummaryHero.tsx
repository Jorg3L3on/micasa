'use client';

import { Info } from 'lucide-react';
import { FortnightIncomeGauge } from '@/components/monthly/FortnightIncomeGauge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado, pendiente y resto de presupuesto (vista planificación). */
  incomeRemainder: number;
  /** Saldos efectivo/débito menos pendiente, nómina y resto de presupuesto. */
  fundingNetInAccounts: number;
  /** Si false, se oculta la tarjeta de liquidez (solo aplica a quincena actual o siguiente). */
  fundingNetApplies?: boolean;
  /** Deducciones de nómina pendientes incluidas en incomeRemainder. */
  payrollDeductionAmount?: number;
  /** Resto del presupuesto de la quincena incluido en incomeRemainder / liquidez. */
  budgetRemainingAmount?: number;
  /** Pagado + pendiente + nómina (segmento del gauge distinto al presupuesto). */
  cashCommittedAmount?: number;
  showGauge: boolean;
};

const subBoxClass =
  'rounded-xl border border-border/50 bg-muted/25 px-3 py-2.5 dark:bg-muted/15';

const metricHint = (text: string) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground"
        aria-label={text}
      >
        <Info className="h-3 w-3" aria-hidden data-icon="inline-end" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[16rem] text-xs">
      {text}
    </TooltipContent>
  </Tooltip>
);

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  fundingNetInAccounts,
  fundingNetApplies = true,
  payrollDeductionAmount = 0,
  budgetRemainingAmount = 0,
  cashCommittedAmount = 0,
  showGauge,
}: FortnightSummaryHeroProps) => {
  const incomeRemainderHint = (() => {
    const parts = ['lo pagado', 'lo pendiente planeado'];
    if (payrollDeductionAmount > 0) parts.push('las deducciones de nómina');
    if (budgetRemainingAmount > 0) parts.push('el presupuesto restante');
    if (parts.length === 2) {
      return 'Ingresos de la quincena menos lo pagado y lo pendiente planeado';
    }
    const last = parts.pop()!;
    return `Ingresos menos ${parts.join(', ')} y ${last} de esta quincena`;
  })();

  const liquidityHint = (() => {
    const parts = ['pendiente'];
    if (payrollDeductionAmount > 0) parts.push('nómina');
    if (budgetRemainingAmount > 0) parts.push('presupuesto restante');
    if (parts.length === 1) {
      return 'Saldo en efectivo y débito ahora, menos pendiente de esta quincena';
    }
    const last = parts.pop()!;
    return `Saldo en efectivo y débito ahora, menos ${parts.join(', ')} y ${last} de esta quincena`;
  })();

  const gauge = showGauge ? (
    <FortnightIncomeGauge
      cashCommitted={cashCommittedAmount}
      budgetRemaining={budgetRemainingAmount}
      periodIncome={periodIncome}
      className="mx-auto shrink-0 lg:mx-0"
    />
  ) : null;

  const showBudgetAvailable = budgetRemainingAmount > 0;
  const metricCount =
    1 + (fundingNetApplies ? 1 : 0) + (showBudgetAvailable ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      {gauge ? <div className="flex justify-center lg:hidden">{gauge}</div> : null}

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        {gauge ? (
          <div className="hidden shrink-0 lg:block">{gauge}</div>
        ) : null}

        <div
          className={cn(
            'grid min-w-0 flex-1 gap-2 sm:gap-3',
            metricCount >= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : metricCount === 2
                ? 'grid-cols-2'
                : 'grid-cols-1',
          )}
        >
          <div className={subBoxClass}>
            <div className="mb-1 flex items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                  aria-hidden
                />
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Libre del ingreso
                </span>
              </div>
              {metricHint(incomeRemainderHint)}
            </div>
            <p
              className={cn(
                'font-mono text-base font-bold tabular-nums sm:text-lg',
                incomeRemainder >= 0
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-destructive',
              )}
            >
              {formatCurrency(incomeRemainder)}
            </p>
          </div>

          {fundingNetApplies ? (
            <div className={subBoxClass}>
              <div className="mb-1 flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Liquidez actual
                  </span>
                </div>
                {metricHint(liquidityHint)}
              </div>
              <p
                className={cn(
                  'font-mono text-base font-bold tabular-nums sm:text-lg',
                  fundingNetInAccounts < 0
                    ? 'text-destructive'
                    : 'text-emerald-700 dark:text-emerald-300',
                )}
              >
                {formatCurrency(fundingNetInAccounts)}
              </p>
            </div>
          ) : null}

          {showBudgetAvailable ? (
            <div className={subBoxClass}>
              <div className="mb-1 flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-violet-500"
                    aria-hidden
                  />
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Disponible del presupuesto
                  </span>
                </div>
                {metricHint(
                  'Resto del presupuesto de esta quincena (asignado menos gastado)',
                )}
              </div>
              <p className="font-mono text-base font-bold tabular-nums text-violet-700 dark:text-violet-300 sm:text-lg">
                {formatCurrency(budgetRemainingAmount)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
