'use client';

import { useCallback, useState } from 'react';
import { Banknote, CalendarRange, Loader2, Pencil } from 'lucide-react';
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
  upsertFortnightCardPaymentPlan,
} from '@/lib/api/card-payment-plans';
import { useFinanceContext } from '@/context/finance-context';
import { formatCardObligationAmountSourceHint } from '@/lib/finance/card-statement-obligation';
import type { CardPaymentPlanFormValues } from '@/schemas/credit-card-payment-plan.schema';
import type { CreditCardPaymentPlanView } from '@/types/catalog';
import { cn, formatCurrency } from '@/lib/utils';

type CreditCardPlannedPaymentSectionProps = {
  walletId: number;
  items: CreditCardPaymentPlanView[];
  onPlanUpdated?: () => void;
  onPayCard?: (item: CreditCardPaymentPlanView) => void;
  payingFortnightId?: number | null;
};

const statusAmountClass = (
  status: CreditCardPaymentPlanView['plannerStatus'],
  hasCustomPlan: boolean,
) => {
  if (status === 'pagado') {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (status === 'vencido') {
    return 'text-destructive';
  }
  return hasCustomPlan
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-foreground';
};

export const CreditCardPlannedPaymentSection = ({
  walletId,
  items,
  onPlanUpdated,
  onPayCard,
  payingFortnightId = null,
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

  const handleSavePlan = async (data: CardPaymentPlanFormValues) => {
    if (!editingItem) return;
    setPlanError(null);
    try {
      await upsertFortnightCardPaymentPlan(
        editingItem.fortnightId,
        {
          walletId,
          plannedAmount: data.plannedAmount,
        },
        context,
      );
      toast.success('Pago planeado guardado');
      onPlanUpdated?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo guardar el plan';
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
      toast.success('Se usará el monto sugerido');
      onPlanUpdated?.();
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
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
            <CalendarRange className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none">
              Pago en planificación
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Cuánto pagarás en la quincena; no cambia la deuda total.
            </p>
          </div>
        </div>

        <ul role="list" className="flex flex-col gap-2">
          {items.map((item) => {
            const hasCustomPlan = item.plannedPayment != null;
            const isStalePlan = item.isStaleFullyCoveredPlan === true;
            const fortnightPaid = item.paymentsAppliedToFortnight ?? 0;
            const sourceHint = formatCardObligationAmountSourceHint(
              item.obligationAmountSource,
              item.isEstimate,
            );
            const displayAmount =
              item.plannerStatus === 'pagado'
                ? fortnightPaid
                : item.effectiveAmount;
            const statementMismatch =
              item.plannerStatus === 'pagado' &&
              fortnightPaid > 0 &&
              item.paymentsAppliedToStatement === 0;

            return (
              <li
                key={item.fortnightId}
                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {item.fortnightLabel}
                    {item.isCurrentFortnight ? (
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        · quincena en curso
                      </span>
                    ) : (
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                        · próxima quincena
                      </span>
                    )}
                    {isStalePlan ? (
                      <span className="ml-1.5 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Plan cubierto
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {item.plannerStatus === 'pagado' ? (
                      <>Pagado esta quincena</>
                    ) : (
                      <>
                        Sugerido al corte: {formatCurrency(item.suggestedAmount)}
                        {hasCustomPlan ? ' · plan personalizado' : null}
                      </>
                    )}
                    {isStalePlan ? (
                      <>
                        <span className="text-muted-foreground/30"> · </span>
                        <span className="text-amber-700 dark:text-amber-300">
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
                            item.isEstimate && 'text-amber-700 dark:text-amber-300',
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
                      'font-mono text-sm font-bold tabular-nums',
                      statusAmountClass(item.plannerStatus, hasCustomPlan),
                    )}
                    aria-label={
                      item.plannerStatus === 'pagado'
                        ? `Pagado esta quincena: ${formatCurrency(displayAmount)}`
                        : `Planeado: ${formatCurrency(displayAmount)}`
                    }
                  >
                    {formatCurrency(displayAmount)}
                  </span>
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
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={6}>
                      Editar monto de esta quincena
                    </TooltipContent>
                  </Tooltip>
                  {onPayCard && item.plannerStatus !== 'pagado' ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              'h-8 w-8 rounded-full border-dashed border-emerald-500/40 bg-transparent shadow-none',
                              'transition-colors hover:border-emerald-500/70 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15',
                              'disabled:pointer-events-none disabled:opacity-40',
                              '[&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400',
                            )}
                            disabled={
                              item.outstandingBalance <= 0 ||
                              payingFortnightId === item.fortnightId
                            }
                            onClick={() => onPayCard(item)}
                            aria-label={`Registrar pago: ${item.fortnightLabel}`}
                          >
                            {payingFortnightId === item.fortnightId ? (
                              <Loader2
                                className="size-3.5 shrink-0 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Banknote className="size-3.5" aria-hidden />
                            )}
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
          onSubmit={handleSavePlan}
          onClearPlan={
            editingItem.plannedPayment != null ? handleClearPlan : undefined
          }
          walletName="esta tarjeta"
          fortnightLabel={editingItem.fortnightLabel}
          suggestedAmount={editingItem.suggestedAmount}
          outstandingBalance={editingItem.outstandingBalance}
          initialPlannedAmount={editingItem.effectiveAmount}
          hasCustomPlan={editingItem.plannedPayment != null}
          error={planError}
        />
      ) : null}
    </>
  );
};
