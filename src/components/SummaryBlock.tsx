'use client';

import { useState } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Wallet,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Pencil,
  BarChart3,
  CreditCard,
  Banknote,
  CircleDollarSign,
  PiggyBank,
  Info,
} from 'lucide-react';
import { FortnightSummaryHero } from '@/components/monthly/FortnightSummaryHero';
import { getFortnightSummaryHeader } from '@/components/monthly/fortnight-summary-header';
import type {
  FundingWalletBreakdownItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
} from '@/types/catalog';
import {
  isCalendarFortnightCurrent,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';

export type IncomeItemBySource = {
  id: number;
  amount: number;
  source: string | null;
  userName: string | null;
  templateName: string | null;
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
  /** Desglose por billetera (solo resumen expandido). */
  fundingWalletBreakdown?: FundingWalletBreakdownItem[];
  onEditIncome?: () => void;
  onEditIncomeSource?: (id: number, amount: number) => void;
};

export default function SummaryBlock({
  tenemos,
  pagado,
  pendiente,
  userIncome,
  incomeItems = [],
  year,
  month,
  period,
  expenseCount = 0,
  paidExpenseCount = 0,
  unpaidExpenseCount = 0,
  cardCharges = null,
  planningOrphanCardPayments = null,
  planningCardStatementDue = null,
  planningWalletLoanDue = null,
  planningPayrollLoanDeduction = null,
  planningBudgetRemaining = 0,
  fundingWalletBalanceTotal = 0,
  fundingNetVsPendingExpense = 0,
  fundingWalletBreakdown = [],
  onEditIncome,
  onEditIncomeSource,
}: SummaryBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const headerMeta =
    year != null && month != null && period != null
      ? getFortnightSummaryHeader(year, month, period)
      : null;

  const hasUserIncome =
    userIncome &&
    userIncome.length > 0 &&
    userIncome.some((fi) => fi.userIncome && fi.userIncome.length > 0);

  const payrollLoanDeduction = planningPayrollLoanDeduction?.total ?? 0;
  const budgetRemaining =
    planningBudgetRemaining > 0 ? planningBudgetRemaining : 0;

  /** Compromiso: efectivo/débito + deducciones de nómina + resto del presupuesto. */
  const comprometidoEfectivo =
    pagado + pendiente + payrollLoanDeduction + budgetRemaining;

  /** Ingreso menos pagado, pendiente, nómina y resto de presupuesto (mismo criterio que el API). */
  const trasPagarPlaneado = tenemos - comprometidoEfectivo;

  /**
   * Billeteras vs pendiente cuando la página es la quincena calendario en curso
   * o la inmediata siguiente (mismo mes u otro mes).
   */
  const billeterasVsPendienteAplica =
    year != null && month != null && period != null
      ? isCalendarFortnightCurrent(year, month, period) ||
        isCalendarFortnightNext(year, month, period)
      : true;

  const displayFundingNet = billeterasVsPendienteAplica
    ? fundingNetVsPendingExpense
    : 0;
  const displayFundingWalletTotal = billeterasVsPendienteAplica
    ? fundingWalletBalanceTotal
    : 0;
  const displayPendienteFundingRow = billeterasVsPendienteAplica
    ? pendiente
    : 0;
  const displayBudgetFundingRow = billeterasVsPendienteAplica
    ? budgetRemaining
    : 0;

  const cashCommittedAmount = pagado + pendiente + payrollLoanDeduction;
  const showIncomeRing = tenemos > 0;

  const fundingWalletTypeLabel = (t: string) => {
    if (t === 'CASH') return 'Efectivo';
    if (t === 'DEBIT_CARD') return 'Débito';
    return t;
  };

  const metricHint = (text: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 hover:text-muted-foreground"
          aria-label={text}
        >
          <Info className="h-3 w-3" aria-hidden data-icon="inline-start" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[14rem] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <Card
      className={cn(
        // Match month strip + Presupuesto shell (not card-surface solid bg-card).
        'relative gap-0 overflow-hidden rounded-xl border border-sky-500/20 bg-transparent py-0 shadow-sm',
        'bg-gradient-to-br from-sky-500/8 via-card to-sky-500/2',
        'dark:from-sky-500/14 dark:via-card/60 dark:to-sky-500/4',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
      )}
      role="region"
      aria-label={headerMeta?.title ?? 'Resumen de la quincena'}
    >
      <CardContent className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-sky-600/10 shadow-sm ring-1 ring-sky-500/30 dark:from-sky-400/25 dark:to-sky-500/10"
              aria-hidden
            >
              <BarChart3 className="h-4 w-4 text-sky-600 dark:text-sky-300" data-icon="inline-start" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-sm font-bold leading-tight tracking-tight sm:text-base">
                {headerMeta?.title ?? 'Resumen de la quincena'}
              </CardTitle>
              {headerMeta?.dateRange ? (
                <p className="text-xs text-muted-foreground">
                  {headerMeta.dateRange}
                </p>
              ) : null}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300"
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? 'Ocultar desglose de ingresos y gastos'
                    : 'Ver desglose de ingresos y gastos'
                }
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden data-icon="inline-end" />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden data-icon="inline-end" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} align="end">
              {isExpanded ? 'Ocultar desglose' : 'Ingresos, pagado y pendiente'}
            </TooltipContent>
          </Tooltip>
        </div>

        <FortnightSummaryHero
          periodIncome={tenemos}
          incomeRemainder={trasPagarPlaneado}
          fundingNetInAccounts={displayFundingNet}
          fundingNetApplies={billeterasVsPendienteAplica}
          payrollDeductionAmount={payrollLoanDeduction}
          budgetRemainingAmount={budgetRemaining}
          cashCommittedAmount={cashCommittedAmount}
          showGauge={showIncomeRing}
        />

        {isExpanded && (
          <>
            <Separator className="bg-border/50" />
            {/* Three metric cards */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {/* Ingresos */}
              <div className="relative rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/8 to-blue-500/3 px-2 py-2 dark:from-blue-500/12 dark:to-blue-500/5 sm:px-3 sm:py-3">
                <div className="mb-1.5 flex items-center justify-between gap-1 sm:mb-2">
                  <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/25 dark:bg-blue-500/20 sm:h-6 sm:w-6">
                      <Wallet className="h-3 w-3 text-blue-600 dark:text-blue-400 sm:h-3.5 sm:w-3.5" data-icon="inline-start" />
                    </span>
                    <span className="truncate text-[9px] font-bold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80 sm:text-[10px]">
                      Ingresos
                    </span>
                  </div>
                  {onEditIncome && incomeItems.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100 hover:text-blue-500"
                      onClick={onEditIncome}
                      aria-label="Modificar ingresos de la quincena"
                      tabIndex={0}
                    >
                      <Pencil className="h-2.5 w-2.5" data-icon="inline-start" />
                    </Button>
                  )}
                </div>
                <p className="font-mono text-sm font-black tabular-nums leading-tight text-foreground sm:text-base">
                  {formatCurrency(tenemos)}
                </p>
                {(hasUserIncome || incomeItems.length > 0) && (
                  <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                    {incomeItems.length > 0
                      ? `${incomeItems.length} fuente${incomeItems.length !== 1 ? 's' : ''}`
                      : `${userIncome?.[0]?.userIncome.length ?? 0} fuente${(userIncome?.[0]?.userIncome.length ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>

              {/* Pagado */}
              <div className="relative rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 px-2 py-2 dark:from-emerald-500/12 dark:to-emerald-500/5 sm:px-3 sm:py-3">
                <div className="mb-1.5 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25 dark:bg-emerald-500/20 sm:h-6 sm:w-6">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 sm:h-3.5 sm:w-3.5" data-icon="inline-start" />
                  </span>
                  <span className="truncate text-[9px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 sm:text-[10px]">
                    Pagado
                  </span>
                </div>
                <p className="font-mono text-sm font-black tabular-nums leading-tight text-foreground sm:text-base">
                  {formatCurrency(pagado)}
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                  {expenseCount > 0
                    ? `${paidExpenseCount}/${expenseCount}`
                    : '—'}
                </p>
              </div>

              {/* Pendiente */}
              <div className="relative rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-amber-500/3 px-2 py-2 dark:from-amber-500/12 dark:to-amber-500/5 sm:px-3 sm:py-3">
                <div className="mb-1.5 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/25 dark:bg-amber-500/20 sm:h-6 sm:w-6">
                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 sm:h-3.5 sm:w-3.5" data-icon="inline-start" />
                  </span>
                  <span className="truncate text-[9px] font-bold uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80 sm:text-[10px]">
                    Pendiente
                  </span>
                </div>
                <p className="font-mono text-sm font-black tabular-nums leading-tight text-foreground sm:text-base">
                  {formatCurrency(pendiente)}
                </p>
                <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                  {expenseCount > 0
                    ? `${unpaidExpenseCount} gasto${unpaidExpenseCount !== 1 ? 's' : ''}`
                    : '—'}
                </p>
                {planningCardStatementDue != null &&
                planningCardStatementDue.total > 0 ? (
                  <p className="mt-1 border-t border-amber-500/20 pt-1 text-[10px] leading-snug text-muted-foreground">
                    De eso, {formatCurrency(planningCardStatementDue.total)} son
                    pagos al estado de cuenta (tarjeta).
                  </p>
                ) : null}
                {planningWalletLoanDue != null &&
                planningWalletLoanDue.total > 0 ? (
                  <p className="mt-1 border-t border-amber-500/20 pt-1 text-[10px] leading-snug text-muted-foreground">
                    De eso, {formatCurrency(planningWalletLoanDue.total)} son
                    cuotas de préstamo desde billetera.
                  </p>
                ) : null}
              </div>
            </div>

            {planningPayrollLoanDeduction != null &&
            planningPayrollLoanDeduction.total > 0 ? (
              <p className="text-[10px] leading-snug text-muted-foreground">
                Incluye {formatCurrency(planningPayrollLoanDeduction.total)} en{' '}
                {planningPayrollLoanDeduction.count} deducción
                {planningPayrollLoanDeduction.count !== 1 ? 'es' : ''} de nómina
                (préstamos); reduce el ingreso disponible sin salida de billetera.
              </p>
            ) : null}

            {budgetRemaining > 0 ? (
              <p className="text-[10px] leading-snug text-muted-foreground">
                Incluye {formatCurrency(budgetRemaining)} de presupuesto
                restante de la quincena (lo aún no gastado del sobre); lo ya
                gastado entra en Pagado.
              </p>
            ) : null}

            {planningOrphanCardPayments != null &&
            planningOrphanCardPayments.count > 0 ? (
              <p className="text-[10px] leading-snug text-muted-foreground">
                Incluye {formatCurrency(planningOrphanCardPayments.total)} en{' '}
                {planningOrphanCardPayments.count} pago
                {planningOrphanCardPayments.count !== 1 ? 's' : ''} a tarjeta
                (desde la sección de tarjetas, sin gasto duplicado en la lista).
              </p>
            ) : null}

            {cardCharges != null && cardCharges.total > 0 ? (
              <div
                className={cn(
                  'rounded-xl border border-violet-500/20',
                  'bg-gradient-to-br from-violet-500/8 to-violet-500/3 px-3 py-3 dark:from-violet-500/12 dark:to-violet-500/5',
                )}
                role="region"
                aria-label="Cargos con tarjeta en esta quincena"
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25 dark:bg-violet-500/20">
                    <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" data-icon="inline-start" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80">
                    Cargos a tarjeta
                  </span>
                </div>
                <p className="font-mono text-base font-black tabular-nums leading-tight text-violet-700 dark:text-violet-300">
                  {formatCurrency(cardCharges.total)}
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  Son compras cargadas a la tarjeta; no son salida de efectivo hasta
                  que pagues el estado de cuenta (los pagos a la tarjeta sí cuentan
                  arriba como efectivo/débito).
                  {cardCharges.expenseCount > 0 ? (
                    <>
                      {' '}
                      {cardCharges.expenseCount} movimiento
                      {cardCharges.expenseCount !== 1 ? 's' : ''}:{' '}
                      {formatCurrency(cardCharges.paid)} pagado ·{' '}
                      {formatCurrency(cardCharges.unpaid)} pendiente.
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}

            {/* Desglose billeteras vs pendiente (mismo criterio que la tarjeta héroe) */}
            {billeterasVsPendienteAplica ? (
            <div
              className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/6 to-transparent px-3 py-2.5 dark:from-emerald-500/10 dark:to-transparent"
              role="region"
              aria-label="Desglose de billeteras frente al pendiente de la quincena"
            >
              <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700/90 dark:text-emerald-400/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/25">
                  <Banknote
                    className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                    data-icon="inline-start"
                  />
                </span>
                Desglose de billeteras vs pendiente
              </h4>
              {fundingWalletBreakdown.length > 0 ? (
                <div className="space-y-1">
                  {fundingWalletBreakdown.map((w) => (
                    <div
                      key={w.id}
                      className="-mx-1 flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/40"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        <span className="text-foreground/90">{w.name}</span>
                        <span className="ml-1.5 text-[10px] text-muted-foreground/80">
                          ({fundingWalletTypeLabel(w.type)})
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                        {formatCurrency(w.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                  No hay billeteras activas de efectivo o débito.
                </p>
              )}
              <Separator className="my-2 bg-emerald-500/15" />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Total billeteras (efectivo + débito)
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {formatCurrency(displayFundingWalletTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Menos pendiente de la quincena (no pagado)
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    −{formatCurrency(displayPendienteFundingRow)}
                  </span>
                </div>
                {payrollLoanDeduction > 0 ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Menos deducciones de nómina (préstamos)
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      −{formatCurrency(payrollLoanDeduction)}
                    </span>
                  </div>
                ) : null}
                {displayBudgetFundingRow > 0 ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Menos presupuesto restante de la quincena
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      −{formatCurrency(displayBudgetFundingRow)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2 border-t border-emerald-500/20 pt-2 text-xs font-semibold">
                  <span className="text-emerald-800 dark:text-emerald-300">
                    = Billeteras vs pendiente
                  </span>
                  <span
                    className={cn(
                      'font-mono tabular-nums',
                      displayFundingNet >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-destructive',
                    )}
                  >
                    {formatCurrency(displayFundingNet)}
                  </span>
                </div>
              </div>
            </div>
            ) : null}

            {/* Income breakdown */}
            {(incomeItems.length > 0 || hasUserIncome) && (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 dark:bg-muted/10">
                <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Desglose de ingresos
                </h4>
                {incomeItems.length > 0 ? (
                  <div className="space-y-1">
                    {incomeItems.map((item) => {
                      const label =
                        item.source === '__OVERRIDE__'
                          ? 'Ingreso manual'
                          : item.templateName || item.source || 'Ingreso';
                      const displayLabel = item.userName
                        ? `${item.userName}: ${label}`
                        : label;
                      return (
                        <div
                          key={item.id}
                          className="group -mx-1 flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/40"
                        >
                          <span className="min-w-0 truncate text-xs text-muted-foreground">
                            {displayLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="text-xs font-semibold font-mono tabular-nums">
                              {formatCurrency(item.amount)}
                            </span>
                            {onEditIncomeSource && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() =>
                                  onEditIncomeSource(item.id, item.amount)
                                }
                                aria-label={`Modificar ${displayLabel}`}
                                tabIndex={0}
                              >
                                <Pencil className="h-3 w-3" data-icon="inline-start" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {userIncome?.map((periodIncome) => (
                      <div key={periodIncome.fortnightId} className="space-y-1">
                        {periodIncome.userIncome.map((userInc) => (
                          <div
                            key={userInc.userId}
                            className="-mx-1 flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/40"
                          >
                            <span className="truncate text-xs text-muted-foreground">
                              {userInc.userName}
                            </span>
                            <span className="shrink-0 text-xs font-semibold font-mono tabular-nums">
                              {formatCurrency(userInc.income)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
