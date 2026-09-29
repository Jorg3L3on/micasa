'use client';

import EmptyState from '@/components/EmptyState';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { BouncyAccordion } from '@/components/motion/bouncy-accordion';
import { CurrencyTicker } from '@/components/motion/number-ticker';
import { Money } from '@/components/money';
import { SectionHeader } from '@/components/section-header';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Wallet,
  CheckCircle2,
  Clock,
  Pencil,
  Banknote,
} from 'lucide-react';
import {
  FortnightAccountMetrics,
  FortnightSummaryHero,
} from '@/components/monthly/FortnightSummaryHero';
import { MONTHLY_LIQUID_PANEL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { METRIC_STRIP_CLASS } from '@/components/ui/metric-strip';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { WalletPaymentMethodTypeIcon } from '@/components/wallets/WalletPaymentMethodTypeIcon';
import AssigneeAvatar from '@/components/assignee/AssigneeAvatar';
import {
  getDueToPayComposition,
  getFortnightSummaryHeader,
} from '@/components/monthly/fortnight-summary-header';
import { MonthlyBudgetSidebar } from '@/components/monthly/MonthlyBudgetSidebar';
import { getWalletProviderOption } from '@/lib/wallet-provider-icons';
import type {
  FundingWalletBreakdownItem,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
} from '@/types/catalog';
import type { MonthlyBudgetPanelResult } from '@/types/monthly-budget-panel';
import {
  isCalendarFortnightCurrent,
  isCalendarFortnightNext,
} from '@/lib/fortnight-calendar';
import type { PendingLiquidityLineItem } from '@/lib/finance/pending-liquidity-items';

export type IncomeItemBySource = {
  id: number;
  amount: number;
  source: string | null;
  userName: string | null;
  templateName: string | null;
  categoryId: number | null;
  incomeTemplateId: number | null;
  templateSuggestedAmount: number | null;
  templateCategoryId: number | null;
  templateWalletId: number | null;
  walletId: number | null;
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
  onEditIncomeSource?: (incomeId: number, amount: number, label: string) => void;
  /** Unpaid cash gastos, card cortes, and wallet cuotas inside the pending row. */
  pendingExpenseItems?: PendingLiquidityLineItem[];
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
  pendingExpenseItems = [],
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

  const obligationGapCount = planningCardStatementDue?.obligationGapCount ?? 0;
  const fundingWalletTypeLabel = (t: string) => {
    if (t === 'CASH') return 'Efectivo';
    if (t === 'DEBIT_CARD') return 'Débito';
    return t;
  };

  return (
    <>
    {fundingLiquidityApplies ? (
      <FortnightAccountMetrics
        fundingInAccounts={fundingWalletBalanceTotal}
        fundingLiquidity={fundingNetVsPendingExpense}
      />
    ) : null}
    <Card
      className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'gap-0 py-0')}
      role="region"
      aria-label={headerMeta?.title ?? 'Resumen de la quincena'}
    >
      <CardContent className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
        <FortnightSummaryHero
          periodIncome={tenemos}
          incomeRemainder={trasPagarPlaneado}
          dueToPay={comprometidoEfectivo}
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
          obligationGapCount={obligationGapCount}
        />

        <BouncyAccordion
          value={isExpanded ? 'desglose' : null}
          onValueChange={(next) => {
            setIsExpanded(next === 'desglose');
          }}
          items={[
            {
              id: 'desglose',
              title: isExpanded ? 'Ocultar desglose' : 'Ver desglose',
              description: (
          <div className="flex flex-col gap-3">
            <Separator className="bg-border/50" />

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-status-income/50 px-2 py-2 sm:px-3 sm:py-3',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-1 sm:mb-2">
                  <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-status-income-soft ring-1 ring-status-income-border sm:h-6 sm:w-6">
                      <Wallet
                        className="h-3 w-3 text-status-income sm:h-3.5 sm:w-3.5"
                        data-icon="inline-start"
                      />
                    </span>
                    <span className="truncate eyebrow text-status-income">
                      Ingresos
                    </span>
                  </div>
                  {onEditIncome && incomeItems.length === 0 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100 hover:text-status-income"
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
                <p className="leading-tight">
                  <CurrencyTicker
                    value={tenemos}
                    className="text-sm font-black text-foreground sm:text-base"
                  />
                </p>
                {hasUserIncome || incomeItems.length > 0 ? (
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {incomeItems.length > 0
                      ? `${incomeItems.length} fuente${incomeItems.length !== 1 ? 's' : ''}`
                      : `${userIncome?.[0]?.userIncome.length ?? 0} fuente${(userIncome?.[0]?.userIncome.length ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                ) : null}
              </div>

              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-status-success/50 px-2 py-2 sm:px-3 sm:py-3',
                )}
              >
                <div className="mb-1.5 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-status-success-soft ring-1 ring-status-success-border sm:h-6 sm:w-6">
                    <CheckCircle2
                      className="h-3 w-3 text-status-success sm:h-3.5 sm:w-3.5"
                      data-icon="inline-start"
                    />
                  </span>
                  <span className="truncate eyebrow text-status-success">
                    Pagado
                  </span>
                </div>
                <p className="leading-tight">
                  <CurrencyTicker
                    value={pagado}
                    className="text-sm font-black text-foreground sm:text-base"
                  />
                </p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {expenseCount > 0
                    ? `${paidExpenseCount}/${expenseCount}`
                    : '—'}
                </p>
              </div>

              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-status-pending/50 px-2 py-2 sm:px-3 sm:py-3',
                )}
              >
                <div className="mb-1.5 flex items-center gap-1 sm:mb-2 sm:gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-status-pending-soft ring-1 ring-status-pending-border sm:h-6 sm:w-6">
                    <Clock
                      className="h-3 w-3 text-status-pending sm:h-3.5 sm:w-3.5"
                      data-icon="inline-start"
                    />
                  </span>
                  <span className="truncate eyebrow text-status-pending">
                    Pendiente
                  </span>
                </div>
                <p className="leading-tight">
                  <CurrencyTicker
                    value={pendiente}
                    className="text-sm font-black text-foreground sm:text-base"
                  />
                </p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {expenseCount > 0
                    ? `${unpaidExpenseCount} gasto${unpaidExpenseCount !== 1 ? 's' : ''}`
                    : '—'}
                </p>
                {planningCardStatementDue != null &&
                planningCardStatementDue.total > 0 ? (
                  <p className="mt-1 border-t border-status-pending/20 pt-1 text-caption leading-snug text-muted-foreground">
                    De eso, {formatCurrency(planningCardStatementDue.total)} son
                    pagos al estado de cuenta (tarjeta).
                  </p>
                ) : null}
                {planningWalletLoanDue != null &&
                planningWalletLoanDue.total > 0 ? (
                  <p className="mt-1 border-t border-status-pending/20 pt-1 text-caption leading-snug text-muted-foreground">
                    De eso, {formatCurrency(planningWalletLoanDue.total)} son
                    cuotas de préstamo desde billetera.
                  </p>
                ) : null}
              </div>
            </div>

            {planningPayrollLoanDeduction != null &&
            planningPayrollLoanDeduction.total > 0 ? (
              <p className="text-caption leading-snug text-muted-foreground">
                Incluye {formatCurrency(planningPayrollLoanDeduction.total)} en{' '}
                {planningPayrollLoanDeduction.count} deducción
                {planningPayrollLoanDeduction.count !== 1 ? 'es' : ''} de nómina
                (préstamos); reduce el ingreso disponible sin salida de
                billetera.
              </p>
            ) : null}

            {budgetRemaining > 0 ? (
              <p className="text-caption leading-snug text-muted-foreground">
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
              <p className="text-caption leading-snug text-muted-foreground">
                Incluye {formatCurrency(planningOrphanCardPayments.total)} en{' '}
                {planningOrphanCardPayments.count} pago
                {planningOrphanCardPayments.count !== 1 ? 's' : ''} a tarjeta
                (desde la sección de tarjetas, sin gasto duplicado en la lista).
              </p>
            ) : null}

            {incomeItems.length > 0 || hasUserIncome ? (
              <div
                className={cn(
                  METRIC_STRIP_CLASS,
                  'border-l-[3px] border-l-status-income/50 px-3 py-2.5',
                )}
                role="region"
                aria-label="Desglose de ingresos"
              >
                <SectionHeader
                  level={3}
                  className="mb-2"
                  icon={Wallet}
                  title="Desglose de ingresos"
                />
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
                            <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrency(item.amount)}
                            </span>
                            {onEditIncomeSource && item.incomeTemplateId != null ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  onEditIncomeSource(item.id, item.amount, label)
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
                            <span className="shrink-0 font-sans text-sm font-semibold tabular-nums text-foreground">
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
                  'border-l-[3px] border-l-status-success/50 px-3 py-2.5',
                )}
                role="region"
                aria-label="Desglose de liquidez actual"
              >
                <SectionHeader
                  level={3}
                  className="mb-2"
                  icon={Banknote}
                  title="Desglose de liquidez actual"
                />
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
                                  className="size-5 text-caption"
                                />
                              ) : null}
                              <span className="shrink-0 text-caption text-muted-foreground/80">
                                ({fundingWalletTypeLabel(w.type)})
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 font-sans text-xs font-semibold tabular-nums text-foreground">
                            {formatCurrency(w.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    message="No hay billeteras activas de efectivo o débito."
                    className="py-4"
                  />
                )}
                <Separator className="my-2 bg-status-income/15" />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Balance actual (efectivo + débito)
                    </span>
                    <CurrencyTicker
                      value={displayFundingWalletTotal}
                      className="text-xs font-semibold text-foreground"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Menos pendiente de la quincena (no pagado)
                      </span>
                      <Money value={-displayPendienteFundingRow} size="caption" />
                    </div>
                    {displayPendienteFundingRow > 0 &&
                    pendingExpenseItems.length > 0 ? (
                      <ul
                        className="space-y-0.5 pl-3"
                        aria-label="Gastos pendientes de la quincena"
                      >
                        {pendingExpenseItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-caption leading-snug text-muted-foreground"
                          >
                            <span className="min-w-0 truncate">{item.name}</span>
                            <Money
                              value={-item.amount}
                              size="caption"
                              className="shrink-0"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  {payrollLoanDeduction > 0 ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Menos deducciones de nómina (préstamos)
                      </span>
                      <Money value={-payrollLoanDeduction} size="caption" />
                    </div>
                  ) : null}
                  {displayBudgetFundingRow > 0 ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">
                        Menos del presupuesto de la quincena
                      </span>
                      <Money value={-displayBudgetFundingRow} size="caption" />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 border-t border-status-income/20 pt-2 text-xs font-semibold">
                    <span className={displayFundingNet >= 0 ? 'text-status-income' : 'text-foreground'}>
                      = Liquidez actual
                    </span>
                    <CurrencyTicker
                      value={displayFundingNet}
                      className={cn(
                        'text-xs font-semibold',
                        displayFundingNet >= 0
                          ? 'text-status-income'
                          : 'text-foreground',
                      )}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
              ),
            },
          ]}
          classNames={{
            item: 'bg-transparent',
            trigger:
              'min-h-0 gap-2 rounded-lg px-0 py-0.5 text-sm text-muted-foreground hover:text-foreground focus-visible:bg-transparent',
            title: 'text-sm font-normal text-muted-foreground',
            chevron: 'h-4 w-4',
            body: 'px-0 pb-0 pt-3',
            description: 'text-foreground',
          }}
        />
      </CardContent>
    </Card>
    </>
  );
}
