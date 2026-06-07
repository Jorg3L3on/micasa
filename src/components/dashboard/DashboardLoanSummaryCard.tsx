'use client';

import Link from 'next/link';
import { ArrowRight, HandCoins, Landmark } from 'lucide-react';
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
  const walletDue = data.planningWalletLoanDue;
  const payrollDeduction = data.planningPayrollLoanDeduction;
  const loanObligations = data.upcomingObligations
    .filter((obligation) => obligation.source === 'loan_payment')
    .slice(0, 3);
  const loansHref = `/loans${ownerQueryString}`;
  const walletPendingTotal = walletDue?.total ?? 0;
  const walletPendingCount = walletDue?.count ?? 0;
  const payrollTotal = payrollDeduction?.total ?? 0;
  const payrollCount = payrollDeduction?.count ?? 0;
  const paidTotal = loanSummary?.paidTotal ?? 0;
  const totalCount = loanSummary?.count ?? loanObligations.length;
  const hasLoanActivity =
    Boolean(loanSummary) ||
    walletPendingTotal > 0 ||
    payrollTotal > 0 ||
    loanObligations.length > 0;

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
              Billetera y deducciones de nómina en esta vista
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pendiente billetera
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-xl font-bold tabular-nums sm:text-2xl',
                  walletPendingTotal > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-foreground',
                )}
              >
                {formatCurrency(walletPendingTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {walletPendingCount} cuota{walletPendingCount === 1 ? '' : 's'}{' '}
                desde efectivo/débito
              </p>
            </div>

            <div className="rounded-lg border border-border/60 px-3 py-3">
              <div className="flex items-center gap-1.5">
                <Landmark
                  className="h-3 w-3 text-violet-600 dark:text-violet-400"
                  aria-hidden
                />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Deducción nómina
                </p>
              </div>
              <p
                className={cn(
                  'mt-1 font-mono text-xl font-bold tabular-nums sm:text-2xl',
                  payrollTotal > 0
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-foreground',
                )}
              >
                {formatCurrency(payrollTotal)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {payrollCount > 0
                  ? `${payrollCount} deducción${payrollCount === 1 ? '' : 'es'} pendiente${payrollCount === 1 ? '' : 's'}`
                  : 'Sin deducciones de nómina en el periodo'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricBlock label="Pagado" amount={paidTotal} positive />
            <MetricBlock
              label="Total periodo"
              amount={loanSummary?.total ?? paidTotal + walletPendingTotal + payrollTotal}
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
                        {obligation.description}
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

          {totalCount > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              {totalCount} pago{totalCount === 1 ? '' : 's'} en el periodo (incluye
              pagados y pendientes).
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MetricBlock({
  label,
  amount,
  positive = false,
}: {
  label: string;
  amount: number;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
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
