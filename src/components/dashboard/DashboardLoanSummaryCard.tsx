'use client';

import Link from 'next/link';
import { ArrowRight, HandCoins } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/types/dashboard';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type DashboardLoanSummaryCardProps = {
  data: DashboardData;
  ownerQueryString: string;
};

export default function DashboardLoanSummaryCard({
  data,
  ownerQueryString,
}: DashboardLoanSummaryCardProps) {
  const loanSummary = data.planningLoanPayments;
  const loanObligations = data.upcomingObligations
    .filter((obligation) => obligation.source === 'loan_payment')
    .slice(0, 3);
  const loansHref = `/loans${ownerQueryString}`;
  const pendingTotal =
    loanSummary?.pendingTotal ??
    loanObligations.reduce((sum, obligation) => sum + obligation.amount, 0);
  const paidTotal = loanSummary?.paidTotal ?? 0;
  const pendingCount = loanSummary?.pendingCount ?? loanObligations.length;
  const totalCount = loanSummary?.count ?? loanObligations.length;
  const hasLoanActivity = Boolean(loanSummary) || loanObligations.length > 0;

  return (
    <section
      className="flex min-h-[320px] flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
      aria-label="Préstamos del periodo"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 dark:bg-amber-500/15">
            <HandCoins
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-none text-foreground sm:text-base">
              Préstamos del periodo
            </h3>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Pagos programados dentro de la vista actual
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" asChild>
          <Link href={loansHref}>Ver</Link>
        </Button>
      </div>

      {!hasLoanActivity ? (
        <div className="flex flex-1 items-center">
          <EmptyState
            message="No hay pagos de préstamos en este periodo."
            description="Los próximos pagos aparecerán aquí cuando estén programados."
            action={{
              label: 'Ir a préstamos',
              href: loansHref,
              variant: 'outline',
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="rounded-lg border border-border/60 border-l-[3px] border-l-amber-500/50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pendiente de préstamo
            </p>
            <p
              className={cn(
                'mt-1 font-mono text-2xl font-bold tabular-nums',
                pendingTotal > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground',
              )}
            >
              {formatCurrency(pendingTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pendingCount} pendiente{pendingCount === 1 ? '' : 's'} de{' '}
              {totalCount} pago{totalCount === 1 ? '' : 's'} del periodo
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricBlock
              label="Pagado"
              amount={paidTotal}
              accent="border-l-emerald-500/50"
              positive
            />
            <MetricBlock
              label="Total periodo"
              amount={loanSummary?.total ?? paidTotal + pendingTotal}
              accent="border-l-sky-500/50"
            />
          </div>

          {loanObligations.length > 0 ? (
            <div className="border-t border-border/60 pt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Próximos pagos
              </h4>
              <ul className="mt-3 space-y-2">
                {loanObligations.map((obligation) => (
                  <li
                    key={`${obligation.source}-${obligation.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {obligation.loanName ?? obligation.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {obligation.lender ?? obligation.category} ·{' '}
                        {formatDate(obligation.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm font-bold tabular-nums">
                        {formatCurrency(obligation.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <Link
                          href={buildLoanHref(ownerQueryString, obligation.loanId)}
                          aria-label={`Ver ${obligation.loanName ?? obligation.description}`}
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MetricBlock({
  label,
  amount,
  accent,
  positive = false,
}: {
  label: string;
  amount: number;
  accent: string;
  positive?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border border-border/60 border-l-[3px] px-3 py-2', accent)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-sm font-bold tabular-nums text-foreground',
          positive && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}

function buildLoanHref(ownerQueryString: string, loanId?: number): string {
  const params = new URLSearchParams(ownerQueryString.replace(/^\?/, ''));
  if (loanId != null) params.set('loanId', String(loanId));
  const query = params.toString();
  return query ? `/loans?${query}` : '/loans';
}
