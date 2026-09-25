'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
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
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
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
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="w-[5rem] shrink-0 text-sm font-medium">
                    Vigencia
                  </span>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className="h-9 w-full border-0 bg-transparent px-0 shadow-none"
                      aria-label="Vigencia del pago planeado"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this_cycle">Este corte</SelectItem>
                      <SelectItem value="n_cycles">N cortes</SelectItem>
                      <SelectItem value="until_date">Hasta fecha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            {scope === 'n_cycles' ? (
              <FormField
                control={form.control}
                name="cycleCount"
                render={({ field }) => (
                  <label className="flex items-center gap-3 px-3 py-2">
                    <span className="w-[5rem] shrink-0 text-sm font-medium">
                      Cortes
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={36}
                      inputMode="numeric"
                      aria-label="Número de cortes"
                      className="h-9 w-full bg-transparent font-mono text-sm tabular-nums outline-none"
                      value={field.value ?? 2}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </label>
                )}
              />
            ) : null}
            {scope === 'until_date' ? (
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <label className="flex items-center gap-3 px-3 py-2">
                    <span className="w-[5rem] shrink-0 text-sm font-medium">
                      Hasta
                    </span>
                    <input
                      type="date"
                      aria-label="Vigente hasta"
                      className="h-9 w-full bg-transparent text-sm outline-none"
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </label>
                )}
              />
            ) : null}
          </div>
          {form.formState.errors.cycleCount?.message ||
          form.formState.errors.validUntil?.message ? (
            <p className="px-1 text-xs text-destructive" role="alert">
              {form.formState.errors.cycleCount?.message ??
                form.formState.errors.validUntil?.message}
            </p>
          ) : null}
          {knownPeriodAmount == null && onDeclareZero ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-2 text-amber-700 dark:text-amber-300"
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
              className="h-9 px-2 text-primary-text"
              disabled={form.formState.isSubmitting}
              onClick={() => void handleClear()}
            >
              {hasCustomPlan ? 'Quitar monto planeado' : 'Quitar la declaración de $0'}
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
