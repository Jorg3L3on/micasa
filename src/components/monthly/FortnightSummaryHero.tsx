'use client';

import { FortnightIncomeGauge } from '@/components/monthly/FortnightIncomeGauge';
import { cn, formatCurrency } from '@/lib/utils';
import { PiggyBank } from 'lucide-react';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  availableToSpend: number;
  fundingNetInAccounts: number;
  percentCommitted: number;
  showGauge: boolean;
};

const subBoxClass =
  'rounded-xl border border-border/50 bg-muted/25 px-3 py-2.5 dark:bg-muted/15';

export const FortnightSummaryHero = ({
  periodIncome,
  availableToSpend,
  fundingNetInAccounts,
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
              <PiggyBank
                className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                aria-hidden
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Disponible para gastar
              </span>
            </div>
            <p
              className={cn(
                'bg-gradient-to-r from-sky-600 via-primary to-violet-600 bg-clip-text font-mono text-2xl font-bold tabular-nums text-transparent sm:text-3xl',
                availableToSpend < 0 && 'from-destructive via-destructive to-destructive',
              )}
            >
              {formatCurrency(availableToSpend)}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Después de gastos planeados en la quincena
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
            </div>

            <div className={subBoxClass}>
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dinero en cuentas
                </span>
              </div>
              <p
                className={cn(
                  'font-mono text-base font-bold tabular-nums sm:text-lg',
                  fundingNetInAccounts >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-destructive',
                )}
              >
                {formatCurrency(fundingNetInAccounts)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
