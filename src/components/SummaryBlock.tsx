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

  const tooltipDisponibleAhora =
    'Ingreso de la quincena menos lo ya pagado con efectivo o débito (incluye pagos a tarjeta que ya registraste). Lo pendiente sigue reservado.';

  const tooltipTrasPagarPlaneado =
    planningCardStatementDue != null && planningCardStatementDue.total > 0
      ? 'Ingreso menos gastos en efectivo/débito (pagados y pendientes), pagos a tarjeta ya hechos y lo que aún debes al estado de cuenta en esta quincena (ver pestaña Pagos tarjeta). Las compras recién cargadas a la TC no suman hasta integrarse al corte.'
      : 'Ingreso de la quincena menos todo lo comprometido en efectivo o débito: gastos planeados (pagados y pendientes) y pagos a tarjeta que ya descontaron tu efectivo. Las compras cargadas a la tarjeta no entran aquí hasta que pagues el estado de cuenta.';

  return (
    <Card className="gap-0 overflow-hidden rounded-xl border-border/60 py-0 shadow-md dark:shadow-black/30">
      <CardHeader className="space-y-0 border-b border-border/50 bg-muted/15 px-4 pb-2 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/15"
              aria-hidden
            >
              <BarChart3 className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-base font-semibold leading-tight tracking-tight">
                Resumen de la quincena
              </CardTitle>
              {headerSubtitle ? (
                <p className="text-xs leading-snug text-muted-foreground">
                  {headerSubtitle}
                </p>
              ) : null}
            </div>
          </div>
          {!isExpanded && tenemos > 0 && (
            <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
              <span
                className={cn(
                  'font-mono text-sm font-bold tabular-nums leading-tight',
                  trasPagarPlaneado < 0
                    ? 'text-destructive/85 dark:text-destructive/90'
                    : 'text-foreground',
                )}
              >
                {formatCurrency(trasPagarPlaneado)}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {Math.round(totalSpentPercent)}% comprometido
              </span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
        {!isExpanded && tenemos > 0 && (
          <div className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-l-full bg-foreground/30 transition-all duration-500 dark:bg-foreground/35"
              style={{ width: `${Math.min(paidPercent, 100)}%` }}
            />
            <div
              className={cn(
                'h-full transition-all duration-500',
                paidPercent === 0 ? 'rounded-l-full' : '',
                paidPercent + pendingPercent >= 100 ? 'rounded-r-full' : '',
                totalSpentPercent > 100
                  ? 'bg-destructive/50'
                  : 'bg-muted-foreground/25 dark:bg-muted-foreground/30',
              )}
              style={{
                width: `${Math.min(pendingPercent, 100 - Math.min(paidPercent, 100))}%`,
              }}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-1">
        {/* Hero: disponible hoy vs tras pagar todo lo planeado */}
        <div
          className={cn(
            'relative rounded-lg border border-border/60',
            'bg-muted/20 px-2.5 py-2.5 dark:bg-muted/10 sm:px-3 sm:py-3',
          )}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-0">
            {/* Left: Disponible */}
            <div className="flex flex-col gap-1.5 sm:pr-3 sm:border-r sm:border-border/50">
              {/* Label row */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/40">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-left text-xs font-medium text-muted-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Disponible
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left text-xs leading-snug">
                    {tooltipDisponibleAhora}
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Amount */}
              <p
                className={cn(
                  'pl-8 font-mono text-lg font-semibold tabular-nums leading-tight',
                  disponibleAhora >= 0 ? 'text-foreground/75' : 'text-destructive/70',
                )}
              >
                {formatCurrency(disponibleAhora)}
              </p>
              {tenemos > 0 && (
                <div className="flex items-center gap-1.5 pl-8">
                  <span className="text-[10px] text-muted-foreground/55">Ingreso</span>
                  <span className="font-mono text-[10px] font-medium tabular-nums text-muted-foreground/55">
                    {formatCurrency(tenemos)}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Tras gastos planeados */}
            <div className="flex flex-col gap-1.5 sm:pl-3">
              {/* Label row — same height as left */}
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 dark:bg-emerald-500/20">
                  <Receipt className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-left text-xs font-medium text-muted-foreground underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Tras gastos planeados
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left text-xs leading-snug">
                    {tooltipTrasPagarPlaneado}
                  </TooltipContent>
                </Tooltip>
              </div>
              {/* Hero amount */}
              <p
                className={cn(
                  'pl-8 font-mono text-2xl font-bold tabular-nums leading-tight tracking-tight',
                  trasPagarPlaneado >= 0
                    ? 'text-foreground'
                    : 'text-destructive/85 dark:text-destructive/90',
                )}
              >
                {formatCurrency(trasPagarPlaneado)}
              </p>
              {planningCardStatementDue != null && planningCardStatementDue.total > 0 ? (
                <p className="pl-8 text-[10px] leading-snug text-muted-foreground">
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
                <p className="pl-8 text-[10px] leading-snug text-muted-foreground">
                  Ya incluye {formatCurrency(planningOrphanCardPayments.total)} en{' '}
                  {planningOrphanCardPayments.count} pago
                  {planningOrphanCardPayments.count !== 1 ? 's' : ''} a tarjeta
                  (salida de efectivo).
                </p>
              ) : null}
            </div>
          </div>

          {tenemos > 0 && (
            <div className="relative mt-3 border-t border-border/50 pt-2.5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Uso del ingreso
              </p>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-l-full bg-foreground/35 transition-all duration-500 dark:bg-foreground/40"
                  style={{ width: `${Math.min(paidPercent, 100)}%` }}
                />
                <div
                  className={cn(
                    'h-full bg-muted-foreground/30 transition-all duration-500 dark:bg-muted-foreground/35',
                    paidPercent === 0 && 'rounded-l-full',
                    paidPercent + pendingPercent >= 100 && 'rounded-r-full',
                  )}
                  style={{ width: `${Math.min(pendingPercent, 100 - Math.min(paidPercent, 100))}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                {paidPercent === 0 && pendingPercent === 0 ? (
                  <span className="text-xs italic text-muted-foreground/60">
                    Sin gastos registrados aún
                  </span>
                ) : (
                  <span />
                )}
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round(totalSpentPercent)}% comprometido
                </span>
              </div>
            </div>
          )}
        </div>

        {!isExpanded &&
        ((cardCharges != null && cardCharges.total > 0) ||
          (planningOrphanCardPayments != null &&
            planningOrphanCardPayments.count > 0) ||
          (planningCardStatementDue != null &&
            planningCardStatementDue.total > 0)) ? (
          <p className="text-[10px] leading-snug text-muted-foreground">
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
                Los pagos a tarjeta ya hechos cuentan en “Disponible ahora” y
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
            <Separator className="bg-border/60" />
            {/* Three metric cards */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {/* Ingresos */}
              <div className="relative rounded-lg border border-border/60 border-l-[3px] border-l-blue-500/50 bg-transparent px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10 dark:bg-blue-500/15">
                      <Wallet className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Ingresos
                    </span>
                  </div>
                  {onEditIncome && incomeItems.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100"
                      onClick={onEditIncome}
                      aria-label="Modificar ingresos de la quincena"
                      tabIndex={0}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </Button>
                  )}
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight">
                  {formatCurrency(tenemos)}
                </p>
                {(hasUserIncome || incomeItems.length > 0) && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {incomeItems.length > 0
                      ? `${incomeItems.length} fuente${incomeItems.length !== 1 ? 's' : ''}`
                      : `${userIncome?.[0]?.userIncome.length ?? 0} fuente${(userIncome?.[0]?.userIncome.length ?? 0) !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>

              {/* Pagado */}
              <div className="relative rounded-lg border border-border/60 border-l-[3px] border-l-green-500/50 bg-transparent px-3 py-2.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-green-500/10 dark:bg-green-500/15">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Pagado
                  </span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight">
                  {formatCurrency(pagado)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {expenseCount > 0
                    ? `${paidExpenseCount} de ${expenseCount} gastos`
                    : '—'}
                </p>
              </div>

              {/* Pendiente */}
              <div className="relative rounded-lg border border-border/60 border-l-[3px] border-l-amber-500/50 bg-transparent px-3 py-2.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 dark:bg-amber-500/15">
                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Pendiente
                  </span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight">
                  {formatCurrency(pendiente)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {expenseCount > 0
                    ? `${unpaidExpenseCount} gasto${unpaidExpenseCount !== 1 ? 's' : ''}`
                    : '—'}
                </p>
                {planningCardStatementDue != null &&
                planningCardStatementDue.total > 0 ? (
                  <p className="text-[10px] leading-snug text-muted-foreground mt-1 border-t border-border/40 pt-1">
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
                  'rounded-lg border border-border/60 border-l-[3px] border-l-violet-500/50',
                  'bg-transparent px-3 py-2.5',
                )}
                role="region"
                aria-label="Cargos con tarjeta en esta quincena"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
                    <CreditCard className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cargos a tarjeta
                  </span>
                </div>
                <p className="text-sm font-bold font-mono tabular-nums leading-tight text-violet-700 dark:text-violet-300">
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
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 dark:bg-muted/10">
                <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
