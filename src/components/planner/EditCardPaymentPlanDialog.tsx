'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  cardPaymentPlanFormSchema,
  type CardPaymentPlanFormValues,
} from '@/schemas/credit-card-payment-plan.schema';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  FormAmountRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
} from '@/components/overlay/overlay-form';

type EditCardPaymentPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CardPaymentPlanFormValues) => Promise<void>;
  onClearPlan?: () => Promise<void>;
  walletName: string;
  fortnightLabel: string;
  /** Known period amount. Null when the statement payment is missing. */
  knownPeriodAmount: number | null;
  outstandingBalance: number;
  initialPlannedAmount: number;
  hasCustomPlan: boolean;
  error?: string | null;
};

export const EditCardPaymentPlanDialog = ({
  open,
  onOpenChange,
  onSave,
  onClearPlan,
  walletName,
  fortnightLabel,
  knownPeriodAmount,
  outstandingBalance,
  initialPlannedAmount,
  hasCustomPlan,
  error,
}: EditCardPaymentPlanDialogProps) => {
  const form = useForm<CardPaymentPlanFormValues>({
    resolver: zodResolver(cardPaymentPlanFormSchema),
    defaultValues: {
      plannedAmount: initialPlannedAmount,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ plannedAmount: initialPlannedAmount });
    }
  }, [open, initialPlannedAmount, form]);

  const handleSubmit = async (data: CardPaymentPlanFormValues) => {
    try {
      await onSave(data);
      onOpenChange(false);
    } catch {
      // Parent sets error; keep dialog open so the user can fix it.
    }
  };

  const handleClear = async () => {
    if (!onClearPlan) return;
    try {
      await onClearPlan();
      onOpenChange(false);
    } catch {
      // Parent sets error; keep dialog open so the user can retry.
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title="Pago planeado"
      description={`Cuánto planeas pagar en ${fortnightLabel} para ${walletName}. No cambia la deuda total. Si quitas el monto, vuelve el pago del corte o el aviso de que falta el dato.`}
      busy={form.formState.isSubmitting}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-3"
        >
          {error ? (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <p className="px-1 text-xs text-muted-foreground">
            {knownPeriodAmount != null ? (
              <>
                Toca pagar:{' '}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCurrency(knownPeriodAmount)}
                </span>
              </>
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-300">
                Falta el pago del corte
              </span>
            )}
          </p>
          <p className="px-1 text-xs text-muted-foreground">
            Deuda total:{' '}
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {formatCurrency(outstandingBalance)}
            </span>
          </p>
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <FormField
              control={form.control}
              name="plannedAmount"
              render={({ field }) => (
                <FormAmountRow
                  label="Monto a pagar"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          {hasCustomPlan && onClearPlan ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-2 text-primary-text"
              disabled={form.formState.isSubmitting}
              onClick={() => void handleClear()}
            >
              Quitar monto planeado
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
          >
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Form>
    </ResponsiveOverlay>
  );
};
