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

const subBoxClass = 'orion-metric-tile';

const metricLabelClass =
  'min-w-0 flex-1 text-[10px] font-semibold uppercase leading-snug tracking-wide text-muted-foreground sm:text-[11px] sm:tracking-wider';

const metricHint = (text: string) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground"
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

type MetricCardProps = {
  label: string;
  hint: string;
  amount: number;
  amountClassName: string;
  dotClassName: string;
};

const MetricCard = ({
  label,
  hint,
  amount,
  amountClassName,
  dotClassName,
}: MetricCardProps) => (
  <div className={subBoxClass}>
    <div className="mb-1 flex items-start gap-1.5">
      <span
        className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dotClassName)}
        aria-hidden
      />
      <span className={metricLabelClass}>{label}</span>
      {metricHint(hint)}
    </div>
    <p
      className={cn(
        'font-mono text-base font-bold tabular-nums sm:text-lg',
        amountClassName,
      )}
    >
      {formatCurrency(amount)}
    </p>
  </div>
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
          <MetricCard
            label="Libre del ingreso"
            hint={incomeRemainderHint}
            amount={incomeRemainder}
            dotClassName="bg-primary"
            amountClassName={
              incomeRemainder >= 0
                ? 'text-primary-text'
                : 'text-destructive'
            }
          />

          {fundingNetApplies ? (
            <MetricCard
              label="Liquidez actual"
              hint={liquidityHint}
              amount={fundingNetInAccounts}
              dotClassName="bg-emerald-500"
              amountClassName={
                fundingNetInAccounts < 0
                  ? 'text-destructive'
                  : 'text-emerald-700 dark:text-emerald-300'
              }
            />
          ) : null}

          {showBudgetAvailable ? (
            <MetricCard
              label="Disponible del presupuesto"
              hint="Resto del presupuesto de esta quincena (asignado menos gastado)"
              amount={budgetRemainingAmount}
              dotClassName="bg-violet-500"
              amountClassName="text-violet-700 dark:text-violet-200"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
