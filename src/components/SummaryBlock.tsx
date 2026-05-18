'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import type {
  FundingWalletBreakdownItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
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
  /** Kept for compatibilidad con el API; el héroe usa `tenemos − pagado − pendiente`. */
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
  /** Saldos activos Efectivo + Débito (API resumen). */
  fundingWalletBalanceTotal?: number;
  /** Saldos efectivo/débito menos solo lo pendiente (no pagado) del período (API resumen). */
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
  fundingWalletBalanceTotal = 0,
  fundingNetVsPendingExpense = 0,
  fundingWalletBreakdown = [],
  onEditIncome,
  onEditIncomeSource,
}: SummaryBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const periodDayRange =
    year && month && period
      ? period === 'FIRST'
        ? '1–15'
        : `16–${new Date(year, month, 0).getDate()}`
      : null;

  const quincenaOrdinal =
    period === 'FIRST'
      ? 'Primera quincena'
      : period === 'SECOND'
        ? 'Segunda quincena'
        : null;

  const headerSubtitle =
    quincenaOrdinal && periodDayRange
      ? `${quincenaOrdinal} · Días ${periodDayRange}`
      : quincenaOrdinal ?? (periodDayRange ? `Días ${periodDayRange}` : null);

  const hasUserIncome =
    userIncome &&
    userIncome.length > 0 &&
    userIncome.some((fi) => fi.userIncome && fi.userIncome.length > 0);

  /** Compromiso en efectivo/débito: alinea héroe, barra y tarjetas Pagado/Pendiente. */
  const comprometidoEfectivo = pagado + pendiente;

  /** Ingreso menos todo lo comprometido (pagado + pendiente), mismo criterio que el resumen del API. */
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

  const fundingWalletTypeLabel = (t: string) => {
    if (t === 'CASH') return 'Efectivo';
    if (t === 'DEBIT_CARD') return 'Débito';
    return t;
  };

  return (
    <Card className="relative gap-0 overflow-hidden rounded-2xl border-border/50 py-0 shadow-lg ring-1 ring-primary/5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent dark:ring-primary/10 dark:shadow-black/50 dark:before:via-white/8">
      <CardHeader className="space-y-0 border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-2.5 py-1.5 dark:from-primary/15 dark:via-primary/7 sm:px-3 sm:py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2.5">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/10 shadow-sm ring-1 ring-primary/30 dark:from-primary/30 dark:to-primary/12 dark:ring-primary/35 sm:h-7 sm:w-7"
              aria-hidden
            >
              <BarChart3 className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
            </span>
            <div className="min-w-0 space-y-0">
              <CardTitle className="text-xs font-bold leading-tight tracking-tight sm:text-sm">
                Resumen de la quincena
              </CardTitle>
              {headerSubtitle ? (
                <p
                  className={cn(
                    'text-[11px] leading-snug text-muted-foreground/90 sm:text-xs',
                    !isExpanded && 'hidden sm:block',
                  )}
                >
                  {headerSubtitle}
                </p>
              ) : null}
            </div>
          </div>
          {!isExpanded && tenemos > 0 && (
            <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
              <span
                className={cn(
                  'font-mono text-xs font-bold tabular-nums leading-tight sm:text-sm',
                  billeterasVsPendienteAplica
                    ? displayFundingNet >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {formatCurrency(displayFundingNet)}
              </span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary sm:h-8 sm:w-8"
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? 'Ocultar desglose de ingresos y gastos'
                    : 'Ver desglose de ingresos y gastos'
                }
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} align="end">
              {isExpanded ? 'Ocultar desglose' : 'Ingresos, pagado y pendiente'}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5 px-2.5 pb-2 pt-1.5 sm:px-3 sm:pb-2.5 sm:pt-2">
        {/* Hero KPI strip */}
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-1.5">
          {/* Left: Ingreso total de la quincena */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border border-blue-500/25 px-2 py-1.5',
              'bg-gradient-to-br from-blue-500/10 via-background to-blue-500/3 dark:from-blue-500/18 dark:via-card dark:to-blue-500/5',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent dark:before:via-white/8',
            )}
          >
            <p className="truncate text-[10px] font-semibold leading-tight text-blue-700/80 dark:text-blue-300/80 sm:text-[11px]">
              Ingreso
            </p>
            <p
              className={cn(
                'mt-0.5 font-mono text-base font-bold tabular-nums leading-none sm:text-lg',
                tenemos >= 0 ? 'text-foreground/90' : 'text-destructive',
              )}
            >
              {formatCurrency(tenemos)}
            </p>
          </div>

          {/* Center: restante tras gastos planeados */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm',
              trasPagarPlaneado >= 0
                ? 'border-primary/35 bg-gradient-to-br from-primary/15 via-background to-primary/4 dark:from-primary/22 dark:via-card dark:to-primary/6'
                : 'border-destructive/35 bg-gradient-to-br from-destructive/12 via-background to-destructive/3 dark:from-destructive/20 dark:via-card dark:to-destructive/5',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent dark:before:via-white/10',
            )}
          >
            <p
              className={cn(
                'truncate text-[10px] font-semibold leading-tight sm:text-[11px]',
                trasPagarPlaneado >= 0
                  ? 'text-primary/85'
                  : 'text-destructive/85',
              )}
            >
              Restante
            </p>
            <p
              className={cn(
                'mt-0.5 font-mono text-base font-black tabular-nums leading-none tracking-tight sm:text-lg',
                trasPagarPlaneado >= 0 ? 'text-primary' : 'text-destructive',
              )}
            >
              {formatCurrency(trasPagarPlaneado)}
            </p>
          </div>

          {/* Right: saldos Efectivo + Débito menos solo lo pendiente (quincena en curso o siguiente) */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm',
              billeterasVsPendienteAplica
                ? displayFundingNet >= 0
                  ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-emerald-500/3 dark:from-emerald-500/16 dark:via-card dark:to-emerald-500/5'
                  : 'border-destructive/35 bg-gradient-to-br from-destructive/12 via-background to-destructive/3 dark:from-destructive/20 dark:via-card dark:to-destructive/5'
                : 'border-border/50 bg-gradient-to-br from-muted/30 via-background to-muted/10 text-muted-foreground dark:from-muted/20 dark:via-card dark:to-muted/5',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent dark:before:via-white/8',
            )}
          >
            <p
              className={cn(
                'truncate text-[10px] font-semibold leading-tight sm:text-[11px]',
                billeterasVsPendienteAplica
                  ? displayFundingNet >= 0
                    ? 'text-emerald-700/85 dark:text-emerald-300/85'
                    : 'text-destructive/85'
                  : 'text-muted-foreground',
              )}
            >
              Saldo real
            </p>
            <p
              className={cn(
                'mt-0.5 font-mono text-base font-black tabular-nums leading-none tracking-tight sm:text-lg',
                billeterasVsPendienteAplica
                  ? displayFundingNet >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {formatCurrency(displayFundingNet)}
            </p>
          </div>
        </div>

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
                      <Wallet className="h-3 w-3 text-blue-600 dark:text-blue-400 sm:h-3.5 sm:w-3.5" />
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
                      <Pencil className="h-2.5 w-2.5" />
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
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 sm:h-3.5 sm:w-3.5" />
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
                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400 sm:h-3.5 sm:w-3.5" />
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
              </div>
            </div>

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
                    <CreditCard className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
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
            <div
              className={cn(
                'rounded-xl border px-3 py-2.5',
                billeterasVsPendienteAplica
                  ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/6 to-transparent dark:from-emerald-500/10 dark:to-transparent'
                  : 'border-border/50 bg-gradient-to-br from-muted/20 to-transparent text-muted-foreground dark:from-muted/15',
              )}
              role="region"
              aria-label="Desglose de billeteras frente al pendiente de la quincena"
            >
              <h4
                className={cn(
                  'mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider',
                  billeterasVsPendienteAplica
                    ? 'text-emerald-700/90 dark:text-emerald-400/90'
                    : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1',
                    billeterasVsPendienteAplica
                      ? 'bg-emerald-500/15 ring-emerald-500/25'
                      : 'bg-muted/50 ring-border/50',
                  )}
                >
                  <Banknote
                    className={cn(
                      'h-3 w-3',
                      billeterasVsPendienteAplica
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                </span>
                Desglose de billeteras vs pendiente
              </h4>
              {!billeterasVsPendienteAplica ? (
                <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                  Solo aplica a la quincena en curso o a la siguiente. Aquí se
                  muestran $0,00.
                </p>
              ) : fundingWalletBreakdown.length > 0 ? (
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
              <Separator
                className={cn(
                  'my-2',
                  billeterasVsPendienteAplica
                    ? 'bg-emerald-500/15'
                    : 'bg-border/50',
                )}
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Total billeteras (efectivo + débito)
                  </span>
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      billeterasVsPendienteAplica
                        ? 'text-foreground'
                        : 'text-muted-foreground',
                    )}
                  >
                    {formatCurrency(displayFundingWalletTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Menos pendiente de la quincena (no pagado)
                  </span>
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      billeterasVsPendienteAplica
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    −{formatCurrency(displayPendienteFundingRow)}
                  </span>
                </div>
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 border-t pt-2 text-xs font-semibold',
                    billeterasVsPendienteAplica
                      ? 'border-emerald-500/20'
                      : 'border-border/50',
                  )}
                >
                  <span
                    className={
                      billeterasVsPendienteAplica
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : 'text-muted-foreground'
                    }
                  >
                    = Billeteras vs pendiente
                  </span>
                  <span
                    className={cn(
                      'font-mono tabular-nums',
                      billeterasVsPendienteAplica
                        ? displayFundingNet >= 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {formatCurrency(displayFundingNet)}
                  </span>
                </div>
              </div>
            </div>

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
                                <Pencil className="h-3 w-3" />
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
