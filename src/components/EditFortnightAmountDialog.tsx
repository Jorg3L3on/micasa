'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  createOverrideAmountFormSchema,
  OverrideAmountFormValues,
} from '@/schemas/fortnight.schema';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  FormAmountRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OverlayErrorBanner,
  OverlayHint,
} from '@/components/overlay/overlay-form';

type EditFortnightAmountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: OverrideAmountFormValues) => Promise<void>;
  defaultAmount: number;
  fortnightLabel: string;
  /** Income line being edited (e.g. "Salario Jorge"); omit for the fortnight total. */
  sourceName?: string;
  error?: string | null;
};

export default function EditFortnightAmountDialog({
  open,
  onOpenChange,
  onSave,
  defaultAmount,
  fortnightLabel,
  sourceName,
  error,
}: EditFortnightAmountDialogProps) {
  const schema = useMemo(
    () => createOverrideAmountFormSchema({ requireCategory: false }),
    [],
  );

  const form = useForm<OverrideAmountFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { amount: defaultAmount },
  });

  useEffect(() => {
    if (open) {
      form.reset({ amount: defaultAmount });
    }
  }, [open, defaultAmount, form]);

  const handleSubmit = async (data: OverrideAmountFormValues) => {
    await onSave(data);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const title = sourceName ? `Modificar ${sourceName}` : 'Modificar ingresos';
  const description = sourceName
    ? `Modificar ${sourceName} en ${fortnightLabel}. Monto actual: ${formatCurrency(defaultAmount)}. Solo aplica a esta quincena.`
    : `Modificar ingresos de ${fortnightLabel}. Monto actual: ${formatCurrency(defaultAmount)}. Este monto solo aplica a esta quincena.`;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      busy={form.formState.isSubmitting}
    >
      {() => (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-3"
          >
            <OverlayHint role="status">
              Monto actual:{' '}
              <span className="font-sans font-semibold tabular-nums text-foreground">
                {formatCurrency(defaultAmount)}
              </span>
            </OverlayHint>
            {error ? <OverlayErrorBanner>{error}</OverlayErrorBanner> : null}
            <div className={OVERLAY_GROUPED_CARD_CLASS}>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormAmountRow
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            {sourceName ? (
              <OverlayHint>
                Solo cambia esta quincena. La plantilla de ingresos y el saldo
                no cambian.
              </OverlayHint>
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
      )}
    </ResponsiveOverlay>
  );
}
