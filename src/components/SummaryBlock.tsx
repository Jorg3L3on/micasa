'use client';

import { useState } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import {
  Wallet,
  CheckCircle2,
  Clock,
  ChevronRight,
  Pencil,
  BarChart3,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { FortnightSummaryHero } from '@/components/monthly/FortnightSummaryHero';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { WalletPaymentMethodTypeIcon } from '@/components/wallets/WalletPaymentMethodTypeIcon';
import AssigneeAvatar from '@/components/assignee/AssigneeAvatar';
import {
  getDueToPayComposition,
  getFortnightStatusPill,
  getFortnightSummaryHeader,
} from '@/components/monthly/fortnight-summary-header';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { getWalletProviderOption } from '@/lib/wallet-provider-icons';
import type {
  FundingWalletBreakdownItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
} from '@/types/catalog';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import {
  formatFortnightDateRangeCompact,
  isCalendarFortnightCurrent,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';

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
  /** Kept for API compatibility with callers; not shown in the ledger. */
  libre?: number;
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
  /** Adeudo al estado de cuenta (próximo pago) dentro del período; parte del pendiente. */
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
  /** Cuotas de préstamo desde billetera pendientes en el período; parte del pendiente. */
  planningWalletLoanDue?: PlannerWalletLoanDueSummary | null;
  /** Deducciones de nómina pendientes; reducen el ingreso disponible de la quincena. */
  planningPayrollLoanDeduction?: PlannerPayrollLoanDeductionSummary | null;
  /** Resto del presupuesto de la quincena (total − spent); suma al compromiso. */
  planningBudgetRemaining?: number;
  /** Saldos activos Efectivo + Débito (API resumen) — Balance actual. */
  fundingWalletBalanceTotal?: number;
  /** Saldos efectivo/débito menos pendiente, nómina y resto de presupuesto — Liquidez actual. */
  fundingNetVsPendingExpense?: number;
  /** Desglose por billetera (solo resumen expandido). */
  fundingWalletBreakdown?: FundingWalletBreakdownItem[];
  /** Presupuesto de la quincena; en móvil se muestra dentro del desglose. */
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
  budgetPanel = null,
  budgetOwnerQuery = '',
  onEditIncome,
  onEditIncomeSource,
}: SummaryBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const headerMeta =
    period != null ? getFortnightSummaryHeader(period) : null;

  const hasUserIncome =
    userIncome &&
    userIncome.length > 0 &&
    userIncome.some((fi) => fi.userIncome && fi.userIncome.length > 0);

  const payrollLoanDeduction = planningPayrollLoanDeduction?.total ?? 0;
  const budgetRemaining =
    planningBudgetRemaining > 0 ? planningBudgetRemaining : 0;

  /** Compromiso de efectivo (sin presupuesto): pagado + pendiente + nómina. */
  const cashCommitted = pagado + pendiente + payrollLoanDeduction;

  /** Compromiso total: efectivo + resto del presupuesto. */
  const comprometidoEfectivo = cashCommitted + budgetRemaining;

  /** Ingreso menos compromiso (mismo criterio que el API). */
  const trasPagarPlaneado = tenemos - comprometidoEfectivo;

  /**
   * Liquidez actual solo en la quincena calendario en curso
   * o la inmediata siguiente.
   */
  const isCurrentFortnight =
    year != null && month != null && period != null
      ? isCalendarFortnightCurrent(year, month, period)
      : false;

  const fundingLiquidityApplies =
    year != null && month != null && period != null
      ? isCurrentFortnight || isCalendarFortnightNext(year, month, period)
      : true;

  const displayFundingNet = fundingLiquidityApplies
    ? fundingNetVsPendingExpense
    : 0;
  const displayFundingWalletTotal = fundingLiquidityApplies
    ? fundingWalletBalanceTotal
    : 0;
  const displayPendienteFundingRow = fundingLiquidityApplies ? pendiente : 0;
  const displayBudgetFundingRow = fundingLiquidityApplies
    ? budgetRemaining
    : 0;

  const compositionRows = getDueToPayComposition({
    pagado,
    pendiente,
    statementDue: planningCardStatementDue?.total ?? 0,
    walletLoanDue: planningWalletLoanDue?.total ?? 0,
    payrollDeduction: payrollLoanDeduction,
  });

  const statusPill = getFortnightStatusPill(trasPagarPlaneado);

  const dateRange =
    year != null && month != null && period != null
      ? formatFortnightDateRangeCompact(year, month, period)
      : null;

  const handleToggleExpanded = () => {
    setIsExpanded((current) => !current);
  };

  const fundingWalletTypeLabel = (t: string) => {
    if (t === 'CASH') return 'Efectivo';
    if (t === 'DEBIT_CARD') return 'Débito';
    return t;
  };

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
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-bold leading-tight tracking-tight sm:text-base">
              {headerMeta?.title ?? 'Resumen de la quincena'}
            </CardTitle>
            {dateRange ? (
              <p className="mt-0.5 text-[11px] leading-none text-muted-foreground sm:text-xs">
                {dateRange}
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              statusPill.tone === 'shortfall' &&
                'border-destructive/40 text-destructive',
              statusPill.tone === 'surplus' &&
                'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
              statusPill.tone === 'even' &&
                'border-border/50 text-muted-foreground',
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
          fundingLiquidityApplies={fundingLiquidityApplies}
          showIncomeRemainderBreakdown={!isCurrentFortnight}
          paidAmount={pagado}
          pendingAmount={pendiente}
          cashCommittedAmount={cashCommitted}
          expenseCount={expenseCount}
          paidExpenseCount={paidExpenseCount}
          unpaidExpenseCount={unpaidExpenseCount}
          compositionRows={compositionRows}
          leftoverAmount={budgetRemaining}
          payrollDeductionAmount={payrollLoanDeduction}
        />

        <button
          type="button"
          onClick={handleToggleExpanded}
          className="flex w-full items-center justify-between gap-2 rounded-lg py-0.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Ocultar desglose' : 'Ver desglose'}
        >
          <span>{isExpanded ? 'Ocultar desglose' : 'Ver desglose'}</span>
          <ChevronRight
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
            aria-hidden
            data-icon="inline-end"
          />
        </button>

        {isExpanded ? (
          <>
            <Separator className="bg-border/50" />

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-blue-500/50 px-2 py-2 sm:px-3 sm:py-3',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1 sm:mb-2">
                  <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/25 dark:bg-blue-500/20 sm:h-6 sm:w-6">
                      <Wallet
                        className="h-3 w-3 text-blue-600 dark:text-blue-400 sm:h-3.5 sm:w-3.5"
                        data-icon="inline-start"
                      />
                    </span>
                    <span className="truncate text-[10px] font-bold uppercase tracking-wider text-blue-600/80 dark:text-blue-400/80">
                      Ingresos
                    </span>
                  </div>
                  {onEditIncome && incomeItems.length === 0 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100 hover:text-blue-500"
                      onClick={onEditIncome}
                      aria-label="Modificar ingresos de la quincena"
                      tabIndex={0}
                    >
                      <Pencil
                        className="h-2.5 w-2.5"
                        data-icon="inline-start"
                      />
                    </Button>
                  ) : null}
                </div>
                <p className="font-mono text-sm font-black tabular-nums leading-tight text-foreground sm:text-base">
                  {formatCurrency(tenemos)}
                </p>
                {hasUserIncome || incomeItems.length > 0 ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {incomeItems.length > 0
                      ? `${incomeItems.length} fuente${incomeItems.length !== 1 ? 's' : ''}`
                      : `${userIncome?.[0]?.userIncome.length ?? 0} fuente${(userIncome?.[0]?.userIncome.length ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                ) : null}
              </div>

              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-emerald-500/50 px-2 py-2 sm:px-3 sm:py-3',
                )}
              >
                <div className="mb-1.5 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25 dark:bg-emerald-500/20 sm:h-6 sm:w-6">
                    <CheckCircle2
                      className="h-3 w-3 text-emerald-600 dark:text-emerald-400 sm:h-3.5 sm:w-3.5"
                      data-icon="inline-start"
                    />
                  </span>
                  <span className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                    Pagado
                  </span>
                </div>
                <p className="font-mono text-sm font-black tabular-nums leading-tight text-foreground sm:text-base">
                  {formatCurrency(pagado)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {expenseCount > 0
                    ? `${paidExpenseCount}/${expenseCount}`
                    : '—'}
                </p>
              </div>

              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-amber-500/50 px-2 py-2 sm:px-3 sm:py-3',
                )}
              >
                <div className="mb-1.5 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/25 dark:bg-amber-500/20 sm:h-6 sm:w-6">
                    <Clock
                      className="h-3 w-3 text-amber-600 dark:text-amber-400 sm:h-3.5 sm:w-3.5"
                      data-icon="inline-start"
                    />
                  </span>
                  <span className="truncate text-[10px] font-bold uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">
                    Pendiente
                  </span>
                </div>
                <p className="font-mono text-sm font-black tabular-nums leading-tight text-foreground sm:text-base">
                  {formatCurrency(pendiente)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
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
                (préstamos); reduce el ingreso disponible sin salida de
                billetera.
              </p>
            ) : null}

            {budgetRemaining > 0 ? (
              <p className="text-[10px] leading-snug text-muted-foreground">
                Incluye {formatCurrency(budgetRemaining)} del presupuesto de la
                quincena (lo aún no gastado del sobre); lo ya gastado entra en
                Pagado.
              </p>
            ) : null}

            {budgetPanel != null ? (
              <div className="xl:hidden">
                <MonthlyBudgetSidebar
                  panel={budgetPanel}
                  ownerQuery={budgetOwnerQuery}
                  variant="embedded"
                />
              </div>
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
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-violet-500/50 px-3 py-3',
                )}
                role="region"
                aria-label="Cargos con tarjeta en esta quincena"
              >
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25 dark:bg-violet-500/20">
                    <CreditCard
                      className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
                      data-icon="inline-start"
                    />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600/80 dark:text-violet-400/80">
                    Cargos a tarjeta
                  </span>
                </div>
                <p className="font-mono text-base font-black tabular-nums leading-tight text-violet-700 dark:text-violet-300">
                  {formatCurrency(cardCharges.total)}
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  Son compras cargadas a la tarjeta; no son salida de efectivo
                  hasta que pagues el estado de cuenta (los pagos a la tarjeta
                  sí cuentan arriba como efectivo/débito).
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

            {incomeItems.length > 0 || hasUserIncome ? (
              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-blue-500/50 px-3 py-2.5',
                )}
                role="region"
                aria-label="Desglose de ingresos"
              >
                <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700/90 dark:text-blue-400/90">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/15 ring-1 ring-blue-500/25">
                    <Wallet
                      className="h-3 w-3 text-blue-600 dark:text-blue-400"
                      aria-hidden
                      data-icon="inline-start"
                    />
                  </span>
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
                          <span className="min-w-0 truncate text-sm text-foreground/90">
                            {displayLabel}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrency(item.amount)}
                            </span>
                            {onEditIncomeSource ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  onEditIncomeSource(
                                    item.id,
                                    item.amount,
                                    item.categoryId,
                                  )
                                }
                                aria-label={`Modificar ${displayLabel}`}
                                tabIndex={0}
                              >
                                <Pencil
                                  className="h-3 w-3"
                                  data-icon="inline-start"
                                />
                              </Button>
                            ) : null}
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
                            <span className="truncate text-sm text-foreground/90">
                              {userInc.userName}
                            </span>
                            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrency(userInc.income)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {fundingLiquidityApplies ? (
              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-emerald-500/50 px-3 py-2.5',
                )}
                role="region"
                aria-label="Desglose de liquidez actual"
              >
                <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700/90 dark:text-emerald-400/90">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 ring-1 ring-emerald-500/25">
                    <Banknote
                      className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                      data-icon="inline-start"
                    />
                  </span>
                  Desglose de liquidez actual
                </h4>
                {fundingWalletBreakdown.length > 0 ? (
                  <div className="space-y-1">
                    {fundingWalletBreakdown.map((w) => {
                      const provider = getWalletProviderOption(
                        w.provider_icon_key,
                      );
                      const showProviderLogo = Boolean(provider?.logoPath);

                      return (
                        <div
                          key={w.id}
                          className="-mx-1 flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/40"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                            {showProviderLogo ? (
                              <WalletProviderIcon
                                providerIconKey={w.provider_icon_key}
                                className="h-4 w-4 border-border/40"
                                iconClassName="h-2.5 w-2.5"
                                showTooltipLabel={false}
                              />
                            ) : (
                              <span
                                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/40 bg-muted/70"
                                aria-hidden
                              >
                                <WalletPaymentMethodTypeIcon
                                  type={w.type}
                                  className="h-2.5 w-2.5"
                                />
                              </span>
                            )}
                            <span className="flex min-w-0 items-center gap-1.5 truncate">
                              <span className="truncate text-foreground/90">
                                {w.name}
                              </span>
                              {w.assignee ? (
                                <AssigneeAvatar
                                  name={w.assignee.name}
                                  size="sm"
                                  className="size-5 text-[10px]"
                                />
                              ) : null}
                              <span className="shrink-0 text-[10px] text-muted-foreground/80">
                                ({fundingWalletTypeLabel(w.type)})
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatCurrency(w.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
                    No hay billeteras activas de efectivo o débito.
                  </p>
                )}
                <Separator className="my-2 bg-emerald-500/15" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Balance actual (efectivo + débito)
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
                        Menos del presupuesto de la quincena
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                        −{formatCurrency(displayBudgetFundingRow)}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 border-t border-emerald-500/20 pt-2 text-xs font-semibold">
                    <span className="text-emerald-800 dark:text-emerald-300">
                      = Liquidez actual
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
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
