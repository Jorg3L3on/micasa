'use client';

import Link from 'next/link';
import { ArrowRight, Landmark } from 'lucide-react';
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
      className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card p-6"
      aria-label="Préstamos del periodo"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-foreground">
            Préstamos del periodo
          </h3>
          <p className="text-xs text-muted-foreground">
            Billetera y deducciones de nómina
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={loansHref}>Ver todos</Link>
        </Button>
      </div>

      {!hasLoanActivity ? (
        <div className="flex flex-1 items-center">
          <EmptyState
            message="Sin pagos de préstamos en este periodo."
            description="Los próximos pagos aparecerán aquí cuando estén programados."
            action={{
              label: 'Ir a préstamos',
              href: loansHref,
              variant: 'outline',
            }}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Pendiente billetera
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-xl font-medium tabular-nums',
                  walletPendingTotal > 0
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {formatCurrency(walletPendingTotal)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {walletPendingCount} cuota{walletPendingCount === 1 ? '' : 's'}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <Landmark
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden
                />
                <p className="text-xs text-muted-foreground">
                  Deducción nómina
                </p>
              </div>
              <p
                className={cn(
                  'mt-1 font-mono text-xl font-medium tabular-nums',
                  payrollTotal > 0
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {formatCurrency(payrollTotal)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {payrollCount > 0
                  ? `${payrollCount} deducción${payrollCount === 1 ? '' : 'es'}`
                  : 'Sin deducciones'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="mt-1 font-mono text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                {formatCurrency(paidTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total periodo</p>
              <p className="mt-1 font-mono text-sm font-medium tabular-nums text-foreground">
                {formatCurrency(
                  loanSummary?.total ?? paidTotal + walletPendingTotal + payrollTotal,
                )}
              </p>
            </div>
          </div>

          {loanObligations.length > 0 ? (
            <div className="border-t border-border/60 pt-4">
              <p className="mb-2 text-xs text-muted-foreground">
                Próximos pagos
              </p>
              <ul className="space-y-1.5">
                {loanObligations.map((obligation) => (
                  <li
                    key={`${obligation.source}-${obligation.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {obligation.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {obligation.lender ?? obligation.category} ·{' '}
                        {formatDate(obligation.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                        {formatCurrency(obligation.amount)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        asChild
                      >
                        <Link
                          href={buildLoanHref(ownerQueryString, obligation.loanId)}
                          aria-label={`Ver ${obligation.loanName ?? obligation.description}`}
                        >
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {totalCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {totalCount} pago{totalCount === 1 ? '' : 's'} en el periodo.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function buildLoanHref(ownerQueryString: string, loanId?: number): string {
  const params = new URLSearchParams(ownerQueryString.replace(/^\?/, ''));
  if (loanId != null) params.set('loanId', String(loanId));
  const query = params.toString();
  return query ? `/loans?${query}` : '/loans';
}
