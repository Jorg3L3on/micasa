'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi, getPaymentMethodOptions } from '@/lib/api';
import {
  addExpenseSchema,
  AddExpenseFormValues,
} from '@/schemas/transaction.schema';
import type {
  CategoryOption,
  ExpenseTemplateListItem,
  PaymentMethodOption,
} from '@/types/catalog';
import { cn, formatCurrency } from '@/lib/utils';

export type ExpenseFormProps = {
  mode: 'create' | 'edit';
  defaults?: Partial<AddExpenseFormValues>;
  /** When provided, templates are filtered by this period. Otherwise, derived from the selected date. */
  fortnightPeriod?: 'FIRST' | 'SECOND';
  onSubmit: (values: AddExpenseFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  error?: string | null;
  submitLabel?: string;
  showTemplateSelector?: boolean;
  showRecurringFields?: boolean;
};

function getFallbackDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function periodForDate(iso: string): 'FIRST' | 'SECOND' | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const day = Number(iso.split('-')[2]);
  if (!Number.isFinite(day)) return null;
  return day <= 15 ? 'FIRST' : 'SECOND';
}

export default function ExpenseForm({
  mode,
  defaults,
  fortnightPeriod,
  onSubmit,
  onCancel,
  onDelete,
  error,
  submitLabel,
  showTemplateSelector = true,
  showRecurringFields = true,
}: ExpenseFormProps) {
  const { context } = useFinanceContext();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [templates, setTemplates] = useState<ExpenseTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      categoryId: defaults?.categoryId ?? 0,
      amount: defaults?.amount ?? 0,
      paymentMethodId: defaults?.paymentMethodId ?? 0,
      date: defaults?.date ?? getFallbackDate(),
      isPaid: defaults?.isPaid ?? false,
      isRecurring: defaults?.isRecurring ?? false,
      applyToBothFortnights: defaults?.applyToBothFortnights ?? false,
      expenseTemplateId: defaults?.expenseTemplateId ?? null,
    },
  });

  const isRecurring = form.watch('isRecurring');
  const selectedTemplateId = form.watch('expenseTemplateId');
  const selectedPaymentMethodId = form.watch('paymentMethodId');
  const selectedAmount = form.watch('amount');
  const selectedDate = form.watch('date');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesData, paymentMethodsData, templatesData] =
          await Promise.all([
            clientFetchFromApi<CategoryOption[]>(
              '/api/categories',
              undefined,
              context,
            ),
            getPaymentMethodOptions(context),
            clientFetchFromApi<ExpenseTemplateListItem[]>(
              '/api/expense-templates',
              undefined,
              context,
            ),
          ]);
        if (cancelled) return;
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);
        setTemplates(templatesData);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [context]);

  const effectivePeriod: 'FIRST' | 'SECOND' =
    fortnightPeriod ?? periodForDate(selectedDate) ?? 'FIRST';

  const applicableTemplates = useMemo(
    () =>
      templates.filter((t) => {
        if (!t.active) return false;
        return effectivePeriod === 'FIRST'
          ? t.appliesFirstFortnight
          : t.appliesSecondFortnight;
      }),
    [templates, effectivePeriod],
  );

  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find(
        (m) => m.id === Number(selectedPaymentMethodId),
      ),
    [paymentMethods, selectedPaymentMethodId],
  );

  const isCreditCardPaymentMethod =
    selectedPaymentMethod?.type === 'CREDIT_CARD' ||
    selectedPaymentMethod?.type === 'DEPARTMENT_STORE_CARD';

  const projectedCardDebt = useMemo(() => {
    if (!isCreditCardPaymentMethod) return null;
    const currentDebt = Number(selectedPaymentMethod?.amount ?? 0);
    const add = Number(selectedAmount || 0);
    const safeDebt = Number.isFinite(currentDebt) ? currentDebt : 0;
    const safeAdd = Number.isFinite(add) ? add : 0;
    return safeDebt + safeAdd;
  }, [isCreditCardPaymentMethod, selectedAmount, selectedPaymentMethod]);

  const projectedAvailableCredit = useMemo(() => {
    if (
      !isCreditCardPaymentMethod ||
      selectedPaymentMethod?.credit_limit == null ||
      projectedCardDebt == null
    ) {
      return null;
    }
    const limit = Number(selectedPaymentMethod.credit_limit);
    if (!Number.isFinite(limit)) return null;
    return limit - projectedCardDebt;
  }, [isCreditCardPaymentMethod, projectedCardDebt, selectedPaymentMethod]);

  const exceedsCreditLimit =
    isCreditCardPaymentMethod &&
    projectedAvailableCredit != null &&
    projectedAvailableCredit < 0;

  useEffect(() => {
    if (!isCreditCardPaymentMethod) return;
    if (!form.getValues('isPaid')) {
      form.setValue('isPaid', true);
    }
  }, [form, isCreditCardPaymentMethod]);

  const handleTemplateChange = (value: string) => {
    if (!value) {
      form.setValue('expenseTemplateId', null);
      return;
    }
    const templateId = parseInt(value, 10);
    const template = applicableTemplates.find((t) => t.id === templateId);
    if (!template) {
      form.setValue('expenseTemplateId', null);
      return;
    }
    form.setValue('expenseTemplateId', template.id);
    form.setValue('name', template.name);
    if (template.suggestedAmount != null) {
      form.setValue('amount', template.suggestedAmount);
    }
    if (template.paymentMethodId != null) {
      form.setValue('paymentMethodId', Number(template.paymentMethodId));
    }
    const matchingCategory = categories.find(
      (c) => c.name === template.category,
    );
    if (matchingCategory) {
      form.setValue('categoryId', matchingCategory.id);
    }
    form.setValue('isRecurring', template.isRecurring);
    if (template.isRecurring) {
      form.setValue(
        'applyToBothFortnights',
        template.appliesFirstFortnight && template.appliesSecondFortnight,
      );
    } else {
      form.setValue('applyToBothFortnights', false);
    }
  };

  const handleSubmit = async (values: AddExpenseFormValues) => {
    try {
      setIsSubmitting(true);
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4"
      >
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {showTemplateSelector && applicableTemplates.length > 0 && (
          <FormField
            control={form.control}
            name="expenseTemplateId"
            render={() => (
              <FormItem>
                <FormLabel>Usar plantilla de gastos (opcional)</FormLabel>
                <FormControl>
                  <select
                    value={
                      selectedTemplateId ? String(selectedTemplateId) : ''
                    }
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleTemplateChange(e.target.value)
                    }
                    className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    <option value="">Selecciona una plantilla (opcional)</option>
                    {applicableTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input placeholder="Nombre del gasto" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoría</FormLabel>
              <FormControl>
                <select
                  value={field.value?.toString() || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    field.onChange(parseInt(e.target.value, 10))
                  }
                  onBlur={field.onBlur}
                  disabled={loading}
                  className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...field}
                  value={
                    typeof field.value === 'number' && !Number.isNaN(field.value)
                      ? field.value
                      : ''
                  }
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === '') {
                      field.onChange(NaN);
                      return;
                    }
                    const parsed = Number.parseFloat(next);
                    field.onChange(
                      Number.isFinite(parsed) ? parsed : field.value,
                    );
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentMethodId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Método de pago</FormLabel>
              <FormControl>
                <select
                  value={field.value?.toString() || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    field.onChange(parseInt(e.target.value, 10))
                  }
                  onBlur={field.onBlur}
                  disabled={loading}
                  className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Selecciona un método de pago</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {selectedPaymentMethod && (
          <div
            className={cn(
              'rounded-md border px-3 py-2 text-xs',
              exceedsCreditLimit
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border/60 bg-muted/30 text-muted-foreground',
            )}
            role={exceedsCreditLimit ? 'alert' : undefined}
          >
            {isCreditCardPaymentMethod ? (
              <>
                <p className={cn(exceedsCreditLimit && 'text-destructive')}>
                  Esta compra se registrará como pagada y aumentará la deuda
                  actual de la tarjeta.
                </p>
                {projectedCardDebt != null && (
                  <p className="mt-1 font-mono tabular-nums text-foreground">
                    Deuda proyectada: {formatCurrency(projectedCardDebt)}
                    {projectedAvailableCredit != null
                      ? ` · Disponible proyectado: ${formatCurrency(projectedAvailableCredit)}`
                      : ''}
                  </p>
                )}
                {exceedsCreditLimit && (
                  <p className="mt-2 font-medium">
                    El monto supera el crédito disponible de la tarjeta.
                    Ajusta el monto o el método de pago antes de guardar.
                  </p>
                )}
              </>
            ) : (
              <p>Este gasto afectará directamente el saldo de la billetera.</p>
            )}
          </div>
        )}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isPaid"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isCreditCardPaymentMethod}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  {isCreditCardPaymentMethod
                    ? 'Pagado al usar la tarjeta'
                    : 'Pagado'}
                </FormLabel>
              </div>
            </FormItem>
          )}
        />
        {showRecurringFields && (
          <>
            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          form.setValue('applyToBothFortnights', false);
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Es recurrente</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            {isRecurring && (
              <FormField
                control={form.control}
                name="applyToBothFortnights"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Aplicar a ambas quincenas</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            )}
          </>
        )}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {mode === 'edit' && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting || isDeleting}
              className="sm:mr-auto"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting || isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isDeleting || loading || exceedsCreditLimit}
          >
            {isSubmitting
              ? 'Guardando...'
              : (submitLabel ?? (mode === 'edit' ? 'Guardar cambios' : 'Guardar'))}
          </Button>
        </div>
      </form>
    </Form>
  );
}
