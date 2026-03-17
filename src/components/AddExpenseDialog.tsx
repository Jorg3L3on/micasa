'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type AddExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddExpenseFormValues) => Promise<void>;
  fortnightLabel: string;
  fortnightId: number;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  defaultDate?: string;
  error?: string | null;
};

// Helper to get default date within fortnight
function getDefaultDateForFortnight(
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // If the requested month/year is the current month, use today's date if it's in the fortnight
  if (year === currentYear && month === currentMonth) {
    const day = today.getDate();
    if (period === 'FIRST' && day >= 1 && day <= 15) {
      return today.toISOString().split('T')[0];
    } else if (period === 'SECOND' && day >= 16) {
      return today.toISOString().split('T')[0];
    }
  }

  // Otherwise, use the first day of the fortnight
  const day = period === 'FIRST' ? 1 : 16;
  const date = new Date(year, month - 1, day);
  return date.toISOString().split('T')[0];
}

export default function AddExpenseDialog({
  open,
  onOpenChange,
  onSubmit,
  fortnightLabel,
  year,
  month,
  period,
  defaultDate,
  error,
}: AddExpenseDialogProps) {
  const { context } = useFinanceContext();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [templates, setTemplates] = useState<ExpenseTemplateListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      name: '',
      categoryId: 0,
      amount: 0,
      paymentMethodId: 0,
      date: defaultDate || getDefaultDateForFortnight(year, month, period),
      isPaid: false,
      isRecurring: false,
      applyToBothFortnights: false,
      expenseTemplateId: null,
    },
  });

  const isRecurring = form.watch('isRecurring');
  const selectedTemplateId = form.watch('expenseTemplateId');
  const selectedPaymentMethodId = form.watch('paymentMethodId');
  const selectedAmount = form.watch('amount');

  // Fetch categories, payment methods and expense templates
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const [categoriesData, paymentMethodsData, templatesData] =
            await Promise.all([
            clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
            getPaymentMethodOptions(context),
              clientFetchFromApi<ExpenseTemplateListItem[]>(
                '/api/expense-templates',
                undefined,
                context,
              ),
            ]);
          setCategories(categoriesData);
          setPaymentMethods(paymentMethodsData);
          setTemplates(templatesData);
        } catch (err) {
          console.error('Error fetching data:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [open, context]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      const defaultDateValue =
        defaultDate || getDefaultDateForFortnight(year, month, period);
      form.reset({
        name: '',
        categoryId: 0,
        amount: 0,
        paymentMethodId: 0,
        date: defaultDateValue,
        isPaid: false,
        isRecurring: false,
        applyToBothFortnights: false,
        expenseTemplateId: null,
      });
    }
  }, [open, defaultDate, year, month, period, form]);

  const handleSubmit = async (data: AddExpenseFormValues) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const expenseCategories = categories;

  const applicableTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (!template.active) return false;
      if (period === 'FIRST') {
        return template.appliesFirstFortnight;
      }
      return template.appliesSecondFortnight;
    });
  }, [templates, period]);

  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find((method) => method.id === Number(selectedPaymentMethodId)),
    [paymentMethods, selectedPaymentMethodId],
  );

  const isCreditCardPaymentMethod =
    selectedPaymentMethod?.type === 'CREDIT_CARD' ||
    selectedPaymentMethod?.type === 'DEPARTMENT_STORE_CARD';

  const projectedCardDebt = useMemo(() => {
    if (!isCreditCardPaymentMethod) return null;
    return (selectedPaymentMethod?.amount ?? 0) + (selectedAmount || 0);
  }, [isCreditCardPaymentMethod, selectedAmount, selectedPaymentMethod]);

  const projectedAvailableCredit = useMemo(() => {
    if (
      !isCreditCardPaymentMethod ||
      selectedPaymentMethod?.credit_limit == null ||
      projectedCardDebt == null
    ) {
      return null;
    }

    return selectedPaymentMethod.credit_limit - projectedCardDebt;
  }, [isCreditCardPaymentMethod, projectedCardDebt, selectedPaymentMethod]);

  useEffect(() => {
    if (!isCreditCardPaymentMethod) {
      return;
    }

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

    // Prefill form fields from template where possible
    form.setValue('name', template.name);

    if (template.suggestedAmount != null) {
      form.setValue('amount', template.suggestedAmount);
    }

    if (template.paymentMethodId != null) {
      form.setValue('paymentMethodId', Number(template.paymentMethodId));
    }

    const matchingCategory = expenseCategories.find(
      (cat) => cat.name === template.category,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar gasto — {fortnightLabel}</DialogTitle>
          <DialogDescription>
            Crea un nuevo gasto para esta quincena.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {applicableTemplates.length > 0 && (
              <FormField
                control={form.control}
                name="expenseTemplateId"
                render={() => (
                  <FormItem>
                    <FormLabel>Usar plantilla de gastos (opcional)</FormLabel>
                    <FormControl>
                      <select
                        value={selectedTemplateId ? String(selectedTemplateId) : ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          handleTemplateChange(e.target.value)
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">
                          Selecciona una plantilla (opcional)
                        </option>
                        {applicableTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
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
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecciona una categoría</option>
                      {expenseCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
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
                        field.onChange(Number.isFinite(parsed) ? parsed : field.value);
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
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {isCreditCardPaymentMethod ? (
                  <>
                    <p>
                      Esta compra se registrará como pagada y aumentará la deuda
                      actual de la tarjeta.
                    </p>
                    {projectedCardDebt != null && (
                      <p className="mt-1 font-mono tabular-nums text-foreground">
                        Deuda proyectada: {projectedCardDebt.toFixed(2)}
                        {projectedAvailableCredit != null
                          ? ` · Disponible proyectado: ${projectedAvailableCredit.toFixed(2)}`
                          : ''}
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
                        // If unchecking "Es recurrente", also uncheck "Aplicar a ambas quincenas"
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || loading}>
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
