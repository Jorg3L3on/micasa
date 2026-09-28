'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatCurrency } from '@/lib/utils';
import {
  cardPaymentPlanFormSchema,
  type CardPaymentPlanFormValues,
} from '@/schemas/credit-card-payment-plan.schema';
import type { CardPaymentPlanScopePayload } from '@/lib/api/card-payment-plans';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  FormAmountRow,
  FormGroupedRow,
  OptionalDateStepper,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_NUMBER_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OVERLAY_SECONDARY_BUTTON_CLASS,
  OverlayErrorBanner,
  OverlayHint,
} from '@/components/overlay/overlay-form';

type EditCardPaymentPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CardPaymentPlanFormValues) => Promise<void>;
  onClearPlan?: () => Promise<void>;
  onDeclareZero?: (scope: CardPaymentPlanScopePayload) => Promise<void>;
  walletName: string;
  fortnightLabel: string;
  /** Known period amount. Null when the statement payment is missing. */
  knownPeriodAmount: number | null;
  outstandingBalance: number;
  initialPlannedAmount: number;
  initialScope?: CardPaymentPlanFormValues['scope'];
  initialCycleCount?: number | null;
  initialValidUntil?: string | null;
  hasCustomPlan: boolean;
  error?: string | null;
};

export const EditCardPaymentPlanDialog = ({
  open,
  onOpenChange,
  onSave,
  onClearPlan,
  onDeclareZero,
  walletName,
  fortnightLabel,
  knownPeriodAmount,
  outstandingBalance,
  initialPlannedAmount,
  initialScope = 'this_cycle',
  initialCycleCount = null,
  initialValidUntil = null,
  hasCustomPlan,
  error,
}: EditCardPaymentPlanDialogProps) => {
  const form = useForm<CardPaymentPlanFormValues>({
    resolver: zodResolver(cardPaymentPlanFormSchema),
    defaultValues: {
      plannedAmount: initialPlannedAmount,
      scope: initialScope,
      cycleCount: initialCycleCount ?? 2,
      validUntil: initialValidUntil ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        plannedAmount: initialPlannedAmount,
        scope: initialScope,
        cycleCount: initialCycleCount ?? 2,
        validUntil: initialValidUntil ?? '',
      });
    }
  }, [
    open,
    initialPlannedAmount,
    initialScope,
    initialCycleCount,
    initialValidUntil,
    form,
  ]);

  const scope = useWatch({ control: form.control, name: 'scope' });

  const handleSubmit = async (data: CardPaymentPlanFormValues) => {
    try {
      await onSave({
        ...data,
        cycleCount: data.scope === 'n_cycles' ? data.cycleCount : undefined,
        validUntil: data.scope === 'until_date' ? data.validUntil : undefined,
      });
      onOpenChange(false);
    } catch {
      // Parent sets error; keep dialog open so the user can fix it.
    }
  };

  const scopePayload = (): CardPaymentPlanScopePayload => {
    const values = form.getValues();
    return {
      scope: values.scope,
      cycleCount: values.scope === 'n_cycles' ? values.cycleCount : undefined,
      validUntil: values.scope === 'until_date' ? values.validUntil : undefined,
    };
  };

  const handleDeclareZero = async () => {
    if (!onDeclareZero) return;
    try {
      await onDeclareZero(scopePayload());
      onOpenChange(false);
    } catch {
      // Parent sets error; keep dialog open so the user can retry.
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
      {({ handleSelectOpenChange }) => (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-3"
        >
          <OverlayHint role="status">
            {knownPeriodAmount != null ? (
              <>
                Toca pagar:{' '}
                <span className="font-sans font-semibold tabular-nums text-foreground">
                  {formatCurrency(knownPeriodAmount)}
                </span>
              </>
            ) : (
              <span className="font-medium text-amber-700 dark:text-amber-300">
                Falta el pago del corte
              </span>
            )}
            {' · '}Deuda total:{' '}
            <span className="font-sans font-semibold tabular-nums text-foreground">
              {formatCurrency(outstandingBalance)}
            </span>
          </OverlayHint>
          {error ? <OverlayErrorBanner>{error}</OverlayErrorBanner> : null}
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
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormGroupedRow label="Vigencia">
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    onOpenChange={handleSelectOpenChange}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={OVERLAY_ROW_TRIGGER_CLASS}
                        aria-label="Vigencia del pago planeado"
                      >
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="this_cycle">Este corte</SelectItem>
                      <SelectItem value="n_cycles">N cortes</SelectItem>
                      <SelectItem value="until_date">Hasta fecha</SelectItem>
                    </SelectContent>
                  </Select>
                </FormGroupedRow>
              )}
            />
            {scope === 'n_cycles' ? (
              <FormField
                control={form.control}
                name="cycleCount"
                render={({ field }) => (
                  <FormGroupedRow label="Cortes">
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={36}
                        inputMode="numeric"
                        aria-label="Número de cortes"
                        className={OVERLAY_ROW_NUMBER_INPUT_CLASS}
                        value={field.value ?? 2}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value))
                        }
                      />
                    </FormControl>
                  </FormGroupedRow>
                )}
              />
            ) : null}
            {scope === 'until_date' ? (
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormGroupedRow label="Hasta">
                    <OptionalDateStepper
                      label="Vigente hasta"
                      placeholder="Elige fecha"
                      value={field.value ? field.value : null}
                      onChange={(next) => field.onChange(next ?? '')}
                    />
                  </FormGroupedRow>
                )}
              />
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
          >
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
          {knownPeriodAmount == null && onDeclareZero ? (
            <Button
              type="button"
              variant="ghost"
              className={cn(
                OVERLAY_SECONDARY_BUTTON_CLASS,
                'text-amber-700 dark:text-amber-300',
              )}
              disabled={form.formState.isSubmitting}
              onClick={() => void handleDeclareZero()}
            >
              Este ciclo es $0
            </Button>
          ) : null}
          {onClearPlan ? (
            <Button
              type="button"
              variant="ghost"
              className={cn(OVERLAY_SECONDARY_BUTTON_CLASS, 'text-primary-text')}
              disabled={form.formState.isSubmitting}
              onClick={() => void handleClear()}
            >
              {hasCustomPlan ? 'Quitar monto planeado' : 'Quitar la declaración de $0'}
            </Button>
          ) : null}
        </form>
      </Form>
      )}
    </ResponsiveOverlay>
  );
};
