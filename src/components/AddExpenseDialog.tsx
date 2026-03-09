'use client';

import React, { useEffect, useState } from 'react';
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
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';

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
  fortnightId,
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
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseSchema) as any,
    defaultValues: {
      name: '',
      categoryId: 0,
      amount: 0,
      paymentMethodId: 0,
      date: defaultDate || getDefaultDateForFortnight(year, month, period),
      isPaid: false,
      isRecurring: false,
      applyToBothFortnights: false,
    },
  });

  const isRecurring = form.watch('isRecurring');

  // Fetch categories and payment methods
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const [categoriesData, paymentMethodsData] = await Promise.all([
            clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
            getPaymentMethodOptions(context),
          ]);
          setCategories(categoriesData);
          setPaymentMethods(paymentMethodsData);
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

  // Filter categories to only show expense categories (assuming all are expense categories for now)
  // If you have income categories, you might need to filter them out
  const expenseCategories = categories;

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
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
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
                      value={field.value || ''}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
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
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Pagado</FormLabel>
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
            <FormField
              control={form.control}
              name="applyToBothFortnights"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!isRecurring}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Aplicar a ambas quincenas</FormLabel>
                  </div>
                </FormItem>
              )}
            />
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
