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
  Receipt,
  CreditCard,
} from 'lucide-react';
import type {
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
} from '@/types/catalog';

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
  onEditIncome?: () => void;
  onEditIncomeSource?: (id: number, amount: number) => void;
};

export default function SummaryBlock({
  tenemos,
  libre: _libre,
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

  const paidPercent = tenemos > 0 ? (pagado / tenemos) * 100 : 0;
  const pendingPercent = tenemos > 0 ? (pendiente / tenemos) * 100 : 0;
  const totalSpentPercent = paidPercent + pendingPercent;

  /** Compromiso en efectivo/débito: alinea héroe, barra y tarjetas Pagado/Pendiente. */
  const comprometidoEfectivo = pagado + pendiente;

  /** Ingreso de la quincena menos solo lo ya pagado (incluye pagos a tarjeta ya hechos). */
  const disponibleAhora = tenemos - pagado;
  /** Ingreso menos todo lo comprometido (pagado + pendiente), mismo criterio que el resumen del API. */
  const trasPagarPlaneado = tenemos - comprometidoEfectivo;

  const tooltipIngresosHero =
    'Total de ingresos planificados para esta quincena (suma de las fuentes que registraste).';

  const tooltipTrasPagarPlaneado =
    planningCardStatementDue != null && planningCardStatementDue.total > 0
      ? 'Ingreso menos gastos en efectivo/débito (pagados y pendientes), pagos a tarjeta ya hechos y lo que aún debes al estado de cuenta en esta quincena (ver pestaña Pagos tarjeta). Las compras recién cargadas a la TC no suman hasta integrarse al corte.'
      : 'Ingreso de la quincena menos todo lo comprometido en efectivo o débito: gastos planeados (pagados y pendientes) y pagos a tarjeta que ya descontaron tu efectivo. Las compras cargadas a la tarjeta no entran aquí hasta que pagues el estado de cuenta.';

  return (
    <Card className="relative gap-0 overflow-hidden rounded-2xl border-border/50 py-0 shadow-lg ring-1 ring-primary/5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent dark:ring-primary/10 dark:shadow-black/50 dark:before:via-white/8">
      <CardHeader className="space-y-0 border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-3 pb-1.5 pt-2 dark:from-primary/15 dark:via-primary/7 sm:px-3.5 sm:pb-2 sm:pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2.5">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/10 shadow-sm ring-1 ring-primary/30 dark:from-primary/30 dark:to-primary/12 dark:ring-primary/35 sm:h-8 sm:w-8 sm:rounded-xl"
              aria-hidden
            >
              <BarChart3 className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
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
                  trasPagarPlaneado < 0
                    ? 'text-destructive'
                    : 'text-primary',
                )}
              >
                {formatCurrency(trasPagarPlaneado)}
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

      <CardContent className="space-y-2 px-3 pb-2.5 pt-2 sm:space-y-2.5 sm:px-3.5 sm:pb-3 sm:pt-2.5">
        {/* Hero: ingresos de la quincena vs tras pagar todo lo planeado */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
          {/* Left: Ingresos (total quincena) */}
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border border-blue-500/25 px-2 py-2 sm:px-2.5 sm:py-2.5',
              'bg-gradient-to-br from-blue-500/10 via-background to-blue-500/3 dark:from-blue-500/18 dark:via-card dark:to-blue-500/5',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent dark:before:via-white/8',
            )}
          >
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500/25 to-blue-600/10 shadow-sm ring-1 ring-blue-500/30 dark:from-blue-400/25 dark:to-blue-500/10 sm:h-6 sm:w-6 sm:rounded-lg">
                <Wallet className="h-2.5 w-2.5 text-blue-600 dark:text-blue-300 sm:h-3 sm:w-3" aria-hidden />
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="min-w-0 truncate text-left text-[11px] font-semibold text-blue-700/80 underline decoration-dotted decoration-blue-500/30 underline-offset-2 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-blue-300/80 dark:hover:text-blue-200 sm:text-xs"
                  >
                    Ingresos
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left text-xs leading-snug">
                  {tooltipIngresosHero}
                </TooltipContent>
              </Tooltip>
            </div>
            <p
              className={cn(
                'mt-0.5 font-mono text-lg font-bold tabular-nums leading-none sm:text-xl',
                tenemos >= 0 ? 'text-foreground/90' : 'text-destructive',
              )}
            >
              {formatCurrency(tenemos)}
            </p>
            {tenemos > 0 && pagado > 0 && (
              <div
                className={cn(
                  'mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5',
                  !isExpanded && 'hidden sm:flex',
                )}
              >
                <span className="text-[10px] text-muted-foreground/60">
                  Disponible tras pagos en efectivo/débito
                </span>
                <span
                  className={cn(
                    'font-mono text-[10px] font-semibold tabular-nums',
                    disponibleAhora >= 0
                      ? 'text-muted-foreground/80'
                      : 'text-destructive',
                  )}
                >
                  {formatCurrency(disponibleAhora)}
                </span>
              </div>
            )}
          </div>

          {/* Right: Tras gastos planeados — hero */}
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border px-2 py-2 shadow-sm sm:px-2.5 sm:py-2.5',
              trasPagarPlaneado >= 0
                ? 'border-primary/35 bg-gradient-to-br from-primary/15 via-background to-primary/4 dark:from-primary/22 dark:via-card dark:to-primary/6'
                : 'border-destructive/35 bg-gradient-to-br from-destructive/12 via-background to-destructive/3 dark:from-destructive/20 dark:via-card dark:to-destructive/5',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent dark:before:via-white/10',
            )}
          >
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md shadow-sm ring-1 sm:h-6 sm:w-6 sm:rounded-lg',
                  trasPagarPlaneado >= 0
                    ? 'bg-gradient-to-br from-primary/30 to-primary/10 ring-primary/35'
                    : 'bg-gradient-to-br from-destructive/30 to-destructive/10 ring-destructive/35',
                )}
              >
                <Receipt
                  className={cn(
                    'h-2.5 w-2.5 sm:h-3 sm:w-3',
                    trasPagarPlaneado >= 0
                      ? 'text-primary'
                      : 'text-destructive',
                  )}
                  aria-hidden
                />
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'min-w-0 truncate text-left text-[11px] font-semibold underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xs',
                      trasPagarPlaneado >= 0
                        ? 'text-primary/85 decoration-primary/30 hover:text-primary'
                        : 'text-destructive/85 decoration-destructive/30 hover:text-destructive',
                    )}
                  >
                    <span className="sm:hidden">Tras gastos</span>
                    <span className="hidden sm:inline">Tras gastos planeados</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left text-xs leading-snug">
                  {tooltipTrasPagarPlaneado}
                </TooltipContent>
              </Tooltip>
            </div>
            <p
              className={cn(
                'mt-0.5 font-mono text-lg font-black tabular-nums leading-none tracking-tight sm:text-xl',
                trasPagarPlaneado >= 0 ? 'text-primary' : 'text-destructive',
              )}
            >
              {formatCurrency(trasPagarPlaneado)}
            </p>
            {planningCardStatementDue != null && planningCardStatementDue.total > 0 ? (
              <p
                className={cn(
                  'mt-0.5 text-[9px] leading-tight text-muted-foreground/90 sm:text-[10px]',
                  !isExpanded && 'hidden sm:block',
                )}
              >
                Incluye {formatCurrency(planningCardStatementDue.total)} que aún debes
                pagar al estado de cuenta
                {planningCardStatementDue.cardCount > 0
                  ? ` (${planningCardStatementDue.cardCount} tarjeta${
                      planningCardStatementDue.cardCount !== 1 ? 's' : ''
                    })`
                  : ''}
                .
              </p>
            ) : null}
            {planningOrphanCardPayments != null && planningOrphanCardPayments.count > 0 ? (
              <p
                className={cn(
                  'mt-0.5 text-[9px] leading-tight text-muted-foreground/90 sm:text-[10px]',
                  !isExpanded && 'hidden sm:block',
                )}
              >
                Ya incluye {formatCurrency(planningOrphanCardPayments.total)} en{' '}
                {planningOrphanCardPayments.count} pago
                {planningOrphanCardPayments.count !== 1 ? 's' : ''} a tarjeta
                (salida de efectivo).
              </p>
            ) : null}
          </div>
        </div>

        {tenemos > 0 && (
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 via-background to-muted/10 px-2.5 py-2 dark:from-muted/20 dark:via-card dark:to-transparent sm:px-3',
              'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
              !isExpanded && 'hidden sm:block',
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 sm:text-[10px]">
                Uso del ingreso
              </p>
              <span
                className={cn(
                  'font-mono text-[10px] font-bold tabular-nums sm:text-xs',
                  totalSpentPercent > 100
                    ? 'text-destructive'
                    : totalSpentPercent > 80
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-foreground/80',
                )}
              >
                {Math.round(totalSpentPercent)}%
              </span>
            </div>
            <div className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-muted/70 shadow-inner sm:h-2">
              <div
                className="h-full rounded-l-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 dark:from-emerald-400 dark:to-emerald-300"
                style={{ width: `${Math.min(paidPercent, 100)}%` }}
              />
              <div
                className={cn(
                  'h-full transition-all duration-500',
                  paidPercent === 0 && 'rounded-l-full',
                  paidPercent + pendingPercent >= 100 && 'rounded-r-full',
                  totalSpentPercent > 100
                    ? 'bg-gradient-to-r from-destructive to-destructive/70'
                    : 'bg-gradient-to-r from-amber-500 to-amber-400/70 dark:from-amber-400 dark:to-amber-300/60',
                )}
                style={{
                  width: `${Math.min(pendingPercent, 100 - Math.min(paidPercent, 100))}%`,
                }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] sm:text-[10px]">
              {paidPercent === 0 && pendingPercent === 0 ? (
                <span className="italic text-muted-foreground/60">
                  Sin gastos registrados aún
                </span>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="flex items-center gap-1 text-muted-foreground/90">
                    <span className="inline-block h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400 sm:h-1.5 sm:w-1.5" />
                    Pagado
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground/90">
                    <span className="inline-block h-1 w-1 rounded-full bg-amber-400/90 sm:h-1.5 sm:w-1.5" />
                    Pendiente
                  </span>
                </div>
              )}
              <span className="font-medium text-muted-foreground/70">
                comprometido
              </span>
            </div>
          </div>
        )}

        {!isExpanded &&
        ((cardCharges != null && cardCharges.total > 0) ||
          (planningOrphanCardPayments != null &&
            planningOrphanCardPayments.count > 0) ||
          (planningCardStatementDue != null &&
            planningCardStatementDue.total > 0)) ? (
          <p className="hidden text-[10px] leading-snug text-muted-foreground sm:block">
            {planningCardStatementDue != null &&
            planningCardStatementDue.total > 0 ? (
              <>
                “Cuando pagues todo lo planeado” incluye{' '}
                {formatCurrency(planningCardStatementDue.total)} pendiente de
                pago a tarjeta (estado de cuenta).{' '}
              </>
            ) : null}
            {planningOrphanCardPayments != null &&
            planningOrphanCardPayments.count > 0 ? (
              <>
                Los pagos a tarjeta ya hechos cuentan en “Disponible tras pagos” y
                “Cuando pagues todo lo planeado”.{' '}
              </>
            ) : null}
            {cardCharges != null && cardCharges.total > 0 ? (
              <>
                Hay {formatCurrency(cardCharges.total)} cargados a tarjeta (no
                son efectivo hasta pagar el estado de cuenta). Ver desglose
                arriba.
              </>
            ) : null}
          </p>
        ) : null}

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
