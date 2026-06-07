'use client';

import { FortnightIncomeGauge } from '@/components/monthly/FortnightIncomeGauge';
import { cn, formatCurrency } from '@/lib/utils';
import { Wallet } from 'lucide-react';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado y pendiente (vista planificación). */
  incomeRemainder: number;
  /** Saldos efectivo/débito menos pendiente de la quincena. */
  fundingNetInAccounts: number;
  /** Si false, el neto en cuentas no aplica a esta quincena (muestra 0). */
  fundingNetApplies?: boolean;
  percentCommitted: number;
  showGauge: boolean;
};

const subBoxClass =
  'rounded-xl border border-border/50 bg-muted/25 px-3 py-2.5 dark:bg-muted/15';

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  fundingNetInAccounts,
  fundingNetApplies = true,
  percentCommitted,
  showGauge,
}: FortnightSummaryHeroProps) => {
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

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Wallet
                className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Efectivo neto en cuentas
              </span>
            </div>
            <p
              className={cn(
                'font-mono text-2xl font-bold tabular-nums sm:text-3xl',
                !fundingNetApplies && 'text-muted-foreground',
                fundingNetApplies &&
                  (fundingNetInAccounts < 0
                    ? 'text-destructive'
                    : 'text-emerald-700 dark:text-emerald-300'),
              )}
            >
              {formatCurrency(fundingNetInAccounts)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {fundingNetApplies
                ? 'Efectivo y débito en billeteras, menos lo pendiente por pagar y las deducciones de nómina de esta quincena'
                : 'Solo aplica a la quincena en curso o a la siguiente'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className={subBoxClass}>
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-violet-500"
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ingresos del periodo
                </span>
              </div>
              <p
                className={cn(
                  'font-mono text-base font-bold tabular-nums sm:text-lg',
                  periodIncome >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-destructive',
                )}
              >
                {formatCurrency(periodIncome)}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Total recibido en esta quincena
              </p>
            </div>

            <div className={subBoxClass}>
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Libre del ingreso
                </span>
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
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                Ingresos de la quincena menos lo pagado y lo pendiente planeado
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
