'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, CalendarRange, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EditCardPaymentPlanDialog } from '@/components/planner/EditCardPaymentPlanDialog';
import {
  clearFortnightCardPaymentPlan,
  declareFortnightCardPeriodZero,
  upsertFortnightCardPaymentPlan,
} from '@/lib/api/card-payment-plans';
import { useFinanceContext } from '@/context/finance-context';
import { periodObligationPrefillAmount } from '@/lib/finance/card-period-obligation';
import { formatCardObligationAmountSourceHint } from '@/lib/finance/card-statement-obligation';
import { todayCalendarDate } from '@/lib/calendar-dates';
import type { CardPaymentPlanFormValues } from '@/schemas/credit-card-payment-plan.schema';
import type { CreditCardPaymentPlanView } from '@/types/catalog';
import { cn, formatCurrency } from '@/lib/utils';

type CreditCardPlannedPaymentSectionProps = {
  walletId: number;
  items: CreditCardPaymentPlanView[];
  onPlanUpdated?: () => void | Promise<void>;
  onPayCard?: (item: CreditCardPaymentPlanView) => void;
  payingFortnightId?: number | null;
  /** Opens Capturar for this fortnight (the open corte on the hero). */
  requestedCaptureFortnightId?: number | null;
  onRequestedCaptureHandled?: () => void;
};

const statusAmountClass = (
  status: CreditCardPaymentPlanView['plannerStatus'],
  hasCustomPlan: boolean,
) => {
  if (status === 'pagado') {
    return 'text-status-income';
  }
  if (status === 'vencido') {
    return 'text-destructive';
  }
  if (status === 'sin_cargo') {
    return 'text-muted-foreground';
  }
  if (status === 'falta_dato') {
    return 'text-status-pending';
  }
  return hasCustomPlan
    ? 'text-status-info'
    : 'text-foreground';
};

export const CreditCardPlannedPaymentSection = ({
  walletId,
  items,
  onPlanUpdated,
  onPayCard,
  payingFortnightId = null,
  requestedCaptureFortnightId = null,
  onRequestedCaptureHandled,
}: CreditCardPlannedPaymentSectionProps) => {
  const { context } = useFinanceContext();
  const [editingItem, setEditingItem] = useState<CreditCardPaymentPlanView | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const handleOpenDialog = useCallback((item: CreditCardPaymentPlanView) => {
    setPlanError(null);
    setEditingItem(item);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (requestedCaptureFortnightId == null) return;
    const item = items.find(
      (row) => row.fortnightId === requestedCaptureFortnightId,
    );
    onRequestedCaptureHandled?.();
    if (!item) return;
    handleOpenDialog(item);
  }, [
    requestedCaptureFortnightId,
    items,
    handleOpenDialog,
    onRequestedCaptureHandled,
  ]);

  const handleSavePlan = async (data: CardPaymentPlanFormValues) => {
    if (!editingItem) return;
    setPlanError(null);
    try {
      await upsertFortnightCardPaymentPlan(
        editingItem.fortnightId,
        {
          walletId,
          plannedAmount: data.plannedAmount,
          scope: data.scope,
          cycleCount: data.cycleCount,
          validUntil: data.validUntil,
        },
        context,
      );
      toast.success('Pago planeado guardado');
      await onPlanUpdated?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo guardar el plan';
      setPlanError(message);
      throw error;
    }
  };

  const handleDeclareZero = async (scope: {
    scope?: 'this_cycle' | 'n_cycles' | 'until_date';
    cycleCount?: number;
    validUntil?: string;
  }) => {
    if (!editingItem) return;
    setPlanError(null);
    try {
      await declareFortnightCardPeriodZero(
        editingItem.fortnightId,
        walletId,
        context,
        scope,
      );
      toast.success('Este ciclo quedó en $0');
      await onPlanUpdated?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo declarar el ciclo';
      setPlanError(message);
      throw error;
    }
  };

  const handleClearPlan = async () => {
    if (!editingItem) return;
    setPlanError(null);
    try {
      await clearFortnightCardPaymentPlan(
        editingItem.fortnightId,
        walletId,
        context,
      );
      toast.success('Se quitó el monto planeado');
      await onPlanUpdated?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo restablecer';
      setPlanError(message);
      throw error;
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className="rounded-xl border border-border/60 bg-card p-4"
        role="region"
        aria-label="Pagos planeados por quincena"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-info/10 dark:bg-status-info/15">
            <CalendarRange className="h-3.5 w-3.5 text-status-info" data-icon="inline-start" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">
              Pago en planificación
            </p>
            <p className="mt-1 text-caption text-muted-foreground">
              Cuánto pagarás en la quincena; no cambia la deuda total.
            </p>
          </div>
        </div>

        <ul role="list" className="flex flex-col gap-2">
          {items.map((item) => {
            const hasCustomPlan =
              item.plannedPayment != null && item.plannedPayment > 0;
            const isStalePlan = item.isStaleFullyCoveredPlan === true;
            const fortnightPaid = item.paymentsAppliedToFortnight ?? 0;
            const sourceHint = formatCardObligationAmountSourceHint(
              item.obligationAmountSource,
              item.isEstimate,
            );
            const isMissingPayment = item.plannerStatus === 'falta_dato';
            const displayAmount =
              item.plannerStatus === 'pagado'
                ? fortnightPaid > 0
                  ? fortnightPaid
                  : item.paymentsAppliedToStatement > 0
                    ? item.paymentsAppliedToStatement
                    : item.targetAmount
                : item.plannerStatus === 'sin_cargo' || isMissingPayment
                  ? 0
                  : item.effectiveAmount;
            const statementMismatch =
              item.plannerStatus === 'pagado' &&
              fortnightPaid > 0 &&
              item.paymentsAppliedToStatement === 0;
            const isPending =
              (item.plannerStatus === 'por_pagar' ||
                item.plannerStatus === 'vencido') &&
              item.effectiveAmount > 0;
            const corteIsOpen =
              item.statementDueDate.slice(0, 10) < todayCalendarDate();
            const timingLabel = item.isCurrentFortnight
              ? 'quincena en curso'
              : corteIsOpen
                ? 'corte de este estado'
                : 'próxima quincena';
            const canDeclareZero =
              !item.declaredZero &&
              item.outstandingBalance > 0 &&
              (item.periodObligation?.confidence === 'missing' ||
                item.obligationAmountSource === 'none');

            return (
              <li
                key={item.fortnightId}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {item.fortnightLabel}
                    <span className="ml-1.5 text-caption font-normal text-muted-foreground">
                      · {timingLabel}
                    </span>
                    {isStalePlan ? (
                      <span className="ml-1.5 inline-flex items-center rounded-full border border-status-pending/40 bg-status-pending/10 px-1.5 py-0.5 eyebrow text-status-pending">
                        Plan cubierto
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {item.plannerStatus === 'pagado' ? (
                      <>Pagado esta quincena</>
                    ) : isMissingPayment ? (
                      <>Falta el pago del corte</>
                    ) : item.declaredZero ? (
                      <>Este ciclo es $0</>
                    ) : item.plannerStatus === 'sin_cargo' ? (
                      <>Sin cargo en esta quincena</>
                    ) : (
                      <>
                        Toca pagar:{' '}
                        {item.periodObligation?.confidence === 'missing' ||
                        item.periodObligation?.amount == null
                          ? '—'
                          : formatCurrency(item.periodObligation.amount)}
                        {hasCustomPlan
                          ? ' · monto planeado'
                          : item.periodObligation?.basis === 'minimum'
                            ? ' · pago mínimo'
                            : null}
                      </>
                    )}
                    {isStalePlan ? (
                      <>
                        <span className="text-muted-foreground/30"> · </span>
                        <span className="text-status-pending">
                          Limpia el plan; ya no afecta pendientes
                        </span>
                      </>
                    ) : null}
                    {statementMismatch ? (
                      <>
                        <span className="text-muted-foreground/30"> · </span>
                        <span className="text-muted-foreground/60">
                          Pago en quincena; el banco aplica al corte
                        </span>
                      </>
                    ) : null}
                    {sourceHint ? (
                      <>
                        <span className="text-muted-foreground/30"> · </span>
                        <span
                          className={cn(
                            item.isEstimate && 'text-status-pending',
                          )}
                        >
                          {sourceHint}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'font-sans text-sm font-bold tabular-nums',
                      statusAmountClass(item.plannerStatus, hasCustomPlan),
                    )}
                    aria-label={
                      item.plannerStatus === 'pagado'
                        ? `Pagado esta quincena: ${formatCurrency(displayAmount)}`
                        : item.plannerStatus === 'sin_cargo'
                          ? 'Sin cargo'
                          : isMissingPayment
                            ? 'Falta el pago del corte'
                            : `Planeado: ${formatCurrency(displayAmount)}`
                    }
                  >
                    {isMissingPayment ? '—' : formatCurrency(displayAmount)}
                  </span>
                  {canDeclareZero || isMissingPayment ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 shrink-0 px-2 text-xs font-medium text-status-pending hover:text-status-pending"
                      onClick={() => handleOpenDialog(item)}
                      aria-label={`Capturar pago del corte: ${item.fortnightLabel}`}
                    >
                      Capturar
                    </Button>
                  ) : item.plannerStatus !== 'sin_cargo' || item.declaredZero ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenDialog(item)}
                          aria-label={`Editar pago planeado: ${item.fortnightLabel}`}
                        >
                          <Pencil className="size-3.5" aria-hidden data-icon="inline-start" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={6}>
                        Editar monto de esta quincena
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  {onPayCard && isPending ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              'h-8 w-8 rounded-full border-dashed border-status-income/40 bg-transparent shadow-none',
                              'transition-colors hover:border-status-income/70 hover:bg-status-income/10 dark:hover:bg-status-income/15',
                              'disabled:pointer-events-none disabled:opacity-40',
                              '[&_svg]:text-status-income dark:[&_svg]:text-status-income',
                            )}
                            disabled={
                              item.outstandingBalance <= 0 ||
                              payingFortnightId === item.fortnightId
                            }
                            onClick={() => onPayCard(item)}
                            aria-busy={payingFortnightId === item.fortnightId}
                            aria-label={
                              payingFortnightId === item.fortnightId
                                ? `Guardando pago: ${item.fortnightLabel}`
                                : `Registrar pago: ${item.fortnightLabel}`
                            }
                          >
                            <Banknote className="size-3.5" aria-hidden data-icon="inline-start" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={6}>
                        Pagar desde efectivo o débito
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {editingItem ? (
        <EditCardPaymentPlanDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingItem(null);
              setPlanError(null);
            }
          }}
          onSave={handleSavePlan}
          onClearPlan={
            (editingItem.plannedPayment != null &&
              editingItem.plannedPayment > 0) ||
            editingItem.declaredZero
              ? handleClearPlan
              : undefined
          }
          onDeclareZero={
            !editingItem.declaredZero &&
            editingItem.outstandingBalance > 0 &&
            (editingItem.periodObligation?.confidence === 'missing' ||
              editingItem.obligationAmountSource === 'none')
              ? handleDeclareZero
              : undefined
          }
          walletName="esta tarjeta"
          fortnightLabel={editingItem.fortnightLabel}
          knownPeriodAmount={periodObligationPrefillAmount(
            editingItem.periodObligation,
          )}
          outstandingBalance={editingItem.outstandingBalance}
          initialPlannedAmount={
            editingItem.plannedPayment != null &&
            editingItem.plannedPayment > 0
              ? editingItem.plannedPayment
              : (periodObligationPrefillAmount(editingItem.periodObligation) ??
                0)
          }
          initialScope={editingItem.planScope ?? 'this_cycle'}
          initialCycleCount={editingItem.planCycleCount}
          initialValidUntil={editingItem.planValidUntil}
          hasCustomPlan={
            editingItem.plannedPayment != null &&
            editingItem.plannedPayment > 0
          }
          error={planError}
        />
      ) : null}
    </>
  );
};
