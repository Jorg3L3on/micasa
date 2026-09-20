'use client';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { FortnightSummaryHero } from '@/components/monthly/FortnightSummaryHero';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import {
  getDueToPayComposition,
  getFortnightStatusPill,
  getFortnightSummaryHeader,
} from '@/components/monthly/fortnight-summary-header';
import { cn } from '@/lib/utils';
import {
  formatFortnightDateRangeCompact,
  isCalendarFortnightCurrent,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';
import { BarChart3 } from 'lucide-react';
import type {
  PlannerCardStatementDueSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
} from '@/types/catalog';

type SummaryBlockProps = {
  tenemos: number;
  /** Kept for API compatibility with callers; not shown in the ledger. */
  libre?: number;
  pagado: number;
  pendiente: number;
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
  expenseCount?: number;
  paidExpenseCount?: number;
  unpaidExpenseCount?: number;
  /** Adeudo al estado de cuenta (próximo pago) dentro del período; parte del pendiente. */
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
  /** Cuotas de préstamo desde billetera pendientes en el período; parte del pendiente. */
  planningWalletLoanDue?: PlannerWalletLoanDueSummary | null;
  /** Deducciones de nómina pendientes; reducen el ingreso disponible de la quincena. */
  planningPayrollLoanDeduction?: PlannerPayrollLoanDeductionSummary | null;
  /** Resto del presupuesto de la quincena (total − spent); suma al compromiso. */
  planningBudgetRemaining?: number;
  /** Saldos activos Efectivo + Débito (API resumen). */
  fundingWalletBalanceTotal?: number;
  /** Saldos efectivo/débito menos pendiente, nómina y resto de presupuesto. */
  fundingNetVsPendingExpense?: number;
};

const statusPillClass: Record<
  ReturnType<typeof getFortnightStatusPill>['tone'],
  string
> = {
  shortfall:
    'border-destructive/40 bg-destructive/10 text-destructive dark:bg-destructive/15',
  surplus:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  even: 'border-border/60 bg-muted/40 text-muted-foreground',
};

export default function SummaryBlock({
  tenemos,
  pagado,
  pendiente,
  year,
  month,
  period,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
  planningCardStatementDue = null,
  planningWalletLoanDue = null,
  planningPayrollLoanDeduction = null,
  planningBudgetRemaining = 0,
  fundingWalletBalanceTotal = 0,
  fundingNetVsPendingExpense = 0,
}: SummaryBlockProps) {
  const headerMeta =
    period != null ? getFortnightSummaryHeader(period) : null;

  const payrollLoanDeduction = planningPayrollLoanDeduction?.total ?? 0;
  const budgetRemaining =
    planningBudgetRemaining > 0 ? planningBudgetRemaining : 0;

  /** Compromiso de efectivo (sin presupuesto): pagado + pendiente + nómina. */
  const cashCommitted = pagado + pendiente + payrollLoanDeduction;

  /** Compromiso total: efectivo + resto del presupuesto. */
  const comprometidoEfectivo = cashCommitted + budgetRemaining;

  /** Ingreso menos compromiso (mismo criterio que el API). */
  const trasPagarPlaneado = tenemos - comprometidoEfectivo;
  const statusPill = getFortnightStatusPill(trasPagarPlaneado);

  /**
   * Liquidez (billeteras vs pendiente) solo en la quincena calendario en curso
   * o la inmediata siguiente.
   */
  const fundingNetApplies =
    year != null && month != null && period != null
      ? isCalendarFortnightCurrent(year, month, period) ||
        isCalendarFortnightNext(year, month, period)
      : true;

  const compositionRows = getDueToPayComposition({
    pagado,
    pendiente,
    statementDue: planningCardStatementDue?.total ?? 0,
    walletLoanDue: planningWalletLoanDue?.total ?? 0,
    payrollDeduction: payrollLoanDeduction,
    budgetRemaining,
  });

  const dateRange =
    year != null && month != null && period != null
      ? formatFortnightDateRangeCompact(year, month, period)
      : null;

  return (
    <Card
      className={cn(MONTHLY_PANEL_SHELL_CLASS, 'gap-0 py-0')}
      role="region"
      aria-label={headerMeta?.title ?? 'Resumen de la quincena'}
    >
      <CardContent className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={MONTHLY_ICON_PILL_CLASS} aria-hidden>
              <BarChart3 className="h-4 w-4" data-icon="inline-start" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold leading-tight tracking-tight sm:text-base">
                {headerMeta?.title ?? 'Resumen de la quincena'}
              </CardTitle>
              {dateRange ? (
                <p className="mt-0.5 text-[11px] leading-none text-muted-foreground sm:text-xs">
                  {dateRange}
                </p>
              ) : null}
            </div>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
              statusPillClass[statusPill.tone],
            )}
          >
            {statusPill.label}
          </span>
        </div>

        <FortnightSummaryHero
          periodIncome={tenemos}
          incomeRemainder={trasPagarPlaneado}
          dueToPay={comprometidoEfectivo}
          fundingInAccounts={fundingWalletBalanceTotal}
          fundingLiquidity={fundingNetVsPendingExpense}
          fundingLiquidityApplies={fundingNetApplies}
          paidAmount={pagado}
          pendingAmount={pendiente}
          cashCommittedAmount={cashCommitted}
          expenseCount={expenseCount}
          paidExpenseCount={paidExpenseCount}
          unpaidExpenseCount={unpaidExpenseCount}
          compositionRows={compositionRows}
          leftoverAmount={budgetRemaining}
        />
      </CardContent>
    </Card>
  );
}
