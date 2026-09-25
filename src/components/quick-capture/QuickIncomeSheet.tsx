'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  quickIncomeSchema,
  type QuickIncomeFormValues,
} from '@/schemas/transaction.schema';
import type { CategoryOption } from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { formatMonth } from '@/lib/utils';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  DateStepper,
  FieldClearButton,
  FormAmountRow,
  FormGroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';

type QuickIncomeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: QuickIncomeFormValues) => Promise<void>;
  error?: string | null;
};

const emptyValues = (): QuickIncomeFormValues => ({
  name: '',
  categoryId: 0,
  amount: 0,
  date: todayCalendarDate(),
});

const fortnightPreviewLabel = (dateStr: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Quincena según la fecha';
  const { year, month, period } = getCalendarFortnightRefForYmd(dateStr);
  const periodLabel = period === 'FIRST' ? '1ª quincena' : '2ª quincena';
  return `Va a: ${periodLabel} · ${formatMonth(month)} ${year}`;
};

export const QuickIncomeSheet = ({
  open,
  onOpenChange,
  onSave,
  error,
}: QuickIncomeSheetProps) => {
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const form = useForm<QuickIncomeFormValues>({
    resolver: zodResolver(quickIncomeSchema) as never,
    defaultValues: emptyValues(),
  });

  const dateValue = form.watch('date');
  const preview = useMemo(
    () => fortnightPreviewLabel(dateValue || todayCalendarDate()),
    [dateValue],
  );

  useEffect(() => {
    if (!open) return;
    form.reset(emptyValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const categoriesData = await clientFetchFromApi<CategoryOption[]>(
          '/api/categories?kind=income',
          undefined,
          context,
        );
        if (!cancelled) setCategories(categoriesData);
      } catch (err) {
        console.error('Error fetching income categories:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchCategories();
    return () => {
      cancelled = true;
    };
  }, [open, context]);

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      setSubmitting(true);
      await onSave(values);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar ingreso"
      description="La fecha elige la quincena. Este ingreso no se suma a ninguna billetera."
      busy={submitting}
    >
      {({ handleSelectOpenChange }) => (
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error ? (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <p className="px-1 text-xs text-muted-foreground" role="status">
              {preview}
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
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormGroupedRow label="Categoría">
                    <CategoryGroupedSelect
                      categories={categories}
                      value={field.value ? Number(field.value) : undefined}
                      onValueChange={field.onChange}
                      onOpenChange={handleSelectOpenChange}
                      disabled={loading || submitting}
                      includeCategoryId={
                        field.value ? Number(field.value) : null
                      }
                      placeholder="Selecciona"
                      ariaLabel="Categoría de ingreso"
                      triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                    />
                  </FormGroupedRow>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormGroupedRow label="Nombre">
                    <div className="flex items-center gap-1">
                      <FormControl>
                        <Input
                          placeholder="Ej. bono, venta"
                          autoCapitalize="sentences"
                          autoComplete="off"
                          enterKeyHint="done"
                          spellCheck
                          disabled={loading || submitting}
                          className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                          {...field}
                        />
                      </FormControl>
                      {field.value ? (
                        <FieldClearButton
                          label="Borrar nombre"
                          onClear={() => field.onChange('')}
                        />
                      ) : null}
                    </div>
                  </FormGroupedRow>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormGroupedRow label="Fecha">
                    <DateStepper
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormGroupedRow>
                )}
              />
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              Queda en la quincena de esa fecha. El saldo de las billeteras no
              cambia. Para depositarlo, usa Recibir quincena.
            </p>
            <Button
              type="submit"
              disabled={submitting || loading}
              className={OVERLAY_PRIMARY_BUTTON_CLASS}
            >
              {submitting ? 'Guardando…' : 'Guardar'}
            </Button>
          </form>
        </Form>
      )}
    </ResponsiveOverlay>
  );
};
