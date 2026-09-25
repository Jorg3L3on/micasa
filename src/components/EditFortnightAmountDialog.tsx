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
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import type { CategoryOption } from '@/types/catalog';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  FormAmountRow,
  FormGroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';

type EditFortnightAmountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: OverrideAmountFormValues) => Promise<void>;
  defaultAmount: number;
  fortnightLabel: string;
  error?: string | null;
  requireCategory?: boolean;
  categories?: CategoryOption[];
  defaultCategoryId?: number | null;
  /** True when this line comes from an income template. */
  updatesIncomeTemplate?: boolean;
};

export default function EditFortnightAmountDialog({
  open,
  onOpenChange,
  onSave,
  defaultAmount,
  fortnightLabel,
  error,
  requireCategory = false,
  categories = [],
  defaultCategoryId = null,
  updatesIncomeTemplate = false,
}: EditFortnightAmountDialogProps) {
  const schema = useMemo(
    () =>
      createOverrideAmountFormSchema({
        requireCategory,
      }),
    [requireCategory],
  );

  const form = useForm<OverrideAmountFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      amount: defaultAmount,
      categoryId: defaultCategoryId ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: defaultAmount,
        categoryId: defaultCategoryId ?? undefined,
      });
    }
  }, [open, defaultAmount, defaultCategoryId, form, requireCategory]);

  const handleSubmit = async (data: OverrideAmountFormValues) => {
    await onSave(data);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const title = requireCategory ? 'Modificar ingreso' : 'Modificar ingresos';
  const description = requireCategory
    ? updatesIncomeTemplate
      ? `Actualiza la plantilla de ingreso. Quincena: ${fortnightLabel}. El monto no se deposita en ninguna billetera.`
      : `Actualiza este ingreso de ${fortnightLabel}. El monto no se deposita en ninguna billetera.`
    : `Modificar ingresos de ${fortnightLabel}. Monto actual: ${formatCurrency(defaultAmount)}. Este monto solo aplica a esta quincena.`;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      busy={form.formState.isSubmitting}
    >
      {({ handleSelectOpenChange }) => (
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
              Monto actual:{' '}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrency(defaultAmount)}
              </span>
            </p>
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
              {requireCategory ? (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormGroupedRow label="Categoría">
                      <CategoryGroupedSelect
                        categories={categories}
                        value={
                          field.value != null && field.value > 0
                            ? field.value
                            : undefined
                        }
                        onValueChange={field.onChange}
                        onOpenChange={handleSelectOpenChange}
                        includeCategoryId={
                          field.value != null && field.value > 0
                            ? field.value
                            : defaultCategoryId
                        }
                        placeholder="Selecciona"
                        ariaLabel="Categoría"
                        triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                      />
                    </FormGroupedRow>
                  )}
                />
              ) : null}
            </div>
            {requireCategory ? (
              <p className="px-1 text-xs text-muted-foreground">
                {updatesIncomeTemplate
                  ? 'Se guarda en la plantilla y en esta quincena. Para abonar el saldo, usa Recibir quincena.'
                  : 'Este cambio solo ajusta el ingreso planificado. No mueve el saldo de una billetera.'}
              </p>
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
