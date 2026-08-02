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
  /** Ingresos menos pagado y pendiente (vista planificación). */
  incomeRemainder: number;
  /** Saldos efectivo/débito menos pendiente de la quincena. */
  fundingNetInAccounts: number;
  /** Si false, se oculta la tarjeta de liquidez (solo aplica a quincena actual o siguiente). */
  fundingNetApplies?: boolean;
  /** Deducciones de nómina pendientes incluidas en incomeRemainder. */
  payrollDeductionAmount?: number;
  percentCommitted: number;
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
  percentCommitted,
  showGauge,
}: FortnightSummaryHeroProps) => {
  const incomeRemainderHint =
    payrollDeductionAmount > 0
      ? 'Ingresos menos lo pagado, lo pendiente planeado y las deducciones de nómina de esta quincena'
      : 'Ingresos de la quincena menos lo pagado y lo pendiente planeado';

  const liquidityHint =
    'Saldo en efectivo y débito ahora, menos pendiente y nómina de esta quincena';

  const gauge = showGauge ? (
    <FortnightIncomeGauge
      percentCommitted={percentCommitted}
      periodIncome={periodIncome}
      className="mx-auto shrink-0 lg:mx-0"
    />
  ) : null;

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
            fundingNetApplies ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          <div className={subBoxClass}>
            <div className="mb-1 flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                aria-hidden
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Libre del ingreso
              </span>
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
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Liquidez actual
                </span>
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
        </div>
      </div>
    </div>
  );
};
