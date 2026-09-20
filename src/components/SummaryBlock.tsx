'use client';

import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { FortnightSummaryHero } from '@/components/monthly/FortnightSummaryHero';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { getFortnightSummaryHeader } from '@/components/monthly/fortnight-summary-header';
import { cn } from '@/lib/utils';
import {
  formatFortnightDateRangeCompact,
} from '@/lib/fortnight-calendar';
import { BarChart3 } from 'lucide-react';
import type {
  FundingWalletBreakdownItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
} from '@/types/catalog';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';

export type IncomeItemBySource = {
  id: number;
  amount: number;
  source: string | null;
  userName: string | null;
  templateName: string | null;
  categoryId: number | null;
};

type SummaryBlockProps = {
  tenemos: number;
  /** Kept for compatibilidad con el API; el héroe usa `tenemos − pagado − pendiente − resto de presupuesto`. */
  libre: number;
  pagado: number;
  pendiente: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems?: IncomeItemBySource[];
  year?: number;
  month?: number;
  period?: 'FIRST' | 'SECOND';
  expenseCount?: number;
  paidExpenseCount?: number;
  unpaidExpenseCount?: number;
  /** Cargos TC / tienda aparte del efectivo (solo planificación con API de resumen). */
  cardCharges?: PlannerCardChargesSummary | null;
  /** Pagos a tarjeta sin fila de gasto, ya incluidos en totales de efectivo. */
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null;
  /** Adeudo al estado de cuenta (próximo pago) dentro del período; suma al pendiente planificado. */
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
  /** Cuotas de préstamo desde billetera pendientes en el período. */
  planningWalletLoanDue?: PlannerWalletLoanDueSummary | null;
  /** Deducciones de nómina pendientes; reducen el ingreso disponible de la quincena. */
  planningPayrollLoanDeduction?: PlannerPayrollLoanDeductionSummary | null;
  /** Resto del presupuesto de la quincena (total − spent); suma al compromiso. */
  planningBudgetRemaining?: number;
  /** Saldos activos Efectivo + Débito (API resumen). */
  fundingWalletBalanceTotal?: number;
  /** Saldos efectivo/débito menos pendiente, nómina y resto de presupuesto (API resumen). */
  fundingNetVsPendingExpense?: number;
  /** Desglose por billetera. */
  fundingWalletBreakdown?: FundingWalletBreakdownItem[];
  /** Presupuesto de la quincena — mostrado debajo del resumen en móvil. */
  budgetPanel?: MonthlyBudgetPanelResult | null;
  budgetOwnerQuery?: string;
  onEditIncome?: () => void;
  onEditIncomeSource?: (
    id: number,
    amount: number,
    categoryId: number | null,
  ) => void;
};

export default function SummaryBlock({
  tenemos,
  pagado,
  pendiente,
  year,
  month,
  period,
  planningPayrollLoanDeduction = null,
  planningBudgetRemaining = 0,
  fundingWalletBalanceTotal = 0,
  budgetPanel = null,
  budgetOwnerQuery = '',
}: SummaryBlockProps) {
  const headerMeta =
    period != null ? getFortnightSummaryHeader(period) : null;

  const payrollLoanDeduction = planningPayrollLoanDeduction?.total ?? 0;
  const budgetRemaining =
    planningBudgetRemaining > 0 ? planningBudgetRemaining : 0;

  /** Compromiso: efectivo/débito + deducciones de nómina + resto del presupuesto. */
  const comprometidoEfectivo =
    pagado + pendiente + payrollLoanDeduction + budgetRemaining;

  /** Ingreso menos pagado, pendiente, nómina y resto de presupuesto (mismo criterio que el API). */
  const trasPagarPlaneado = tenemos - comprometidoEfectivo;

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
        <div className="flex min-w-0 items-center gap-2.5">
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

        <FortnightSummaryHero
          periodIncome={tenemos}
          incomeRemainder={trasPagarPlaneado}
          dueToPay={comprometidoEfectivo}
          fundingInAccounts={fundingWalletBalanceTotal}
          leftoverAmount={budgetRemaining}
        />

        {budgetPanel != null ? (
          <MonthlyBudgetSidebar
            panel={budgetPanel}
            ownerQuery={budgetOwnerQuery}
            className="xl:hidden"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
