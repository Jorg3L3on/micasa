'use client';

import { useEffect, useState } from 'react';
import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  addExpenseSchema,
  type AddExpenseFormValues,
} from '@/schemas/transaction.schema';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { cn, formatCurrency } from '@/lib/utils';
import { getWalletProviderOption } from '@/lib/wallet-provider-icons';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

type DashboardQuickExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddExpenseFormValues) => Promise<void>;
  fortnight: {
    id: number;
    label: string;
    year: number;
    month: number;
    period: 'FIRST' | 'SECOND';
  };
};

function getDefaultDateWithinFortnight(
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (year === currentYear && month === currentMonth) {
    const day = today.getDate();
    if (period === 'FIRST' && day >= 1 && day <= 15) {
      return today.toISOString().split('T')[0];
    }
    if (period === 'SECOND' && day >= 16) {
      return today.toISOString().split('T')[0];
    }
  }

  const day = period === 'FIRST' ? 1 : 16;
  const date = new Date(year, month - 1, day);
  return date.toISOString().split('T')[0];
}

export default function DashboardQuickExpenseDialog({
  open,
  onOpenChange,
  onSubmit,
  fortnight,
}: DashboardQuickExpenseDialogProps) {
  const { context } = useFinanceContext();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: {
      name: '',
      categoryId: 0,
      amount: 0,
      paymentMethodId: 0,
      date: getDefaultDateWithinFortnight(
        fortnight.year,
        fortnight.month,
        fortnight.period,
      ),
      isPaid: false,
      isRecurring: false,
      applyToBothFortnights: false,
    },
  });

  const isRecurring = form.watch('isRecurring');
  const selectedPaymentMethodId = form.watch('paymentMethodId');
  const selectedAmount = form.watch('amount');

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
    if (!open) {
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesData, paymentMethodsData] = await Promise.all([
          clientFetchFromApi<CategoryOption[]>(
            '/api/categories',
            undefined,
            context,
          ),
          getPaymentMethodOptions(context),
        ]);
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);
      } catch (error) {
        console.error('Error fetching data for quick expense dialog:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, context]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultDate = getDefaultDateWithinFortnight(
      fortnight.year,
      fortnight.month,
      fortnight.period,
    );
    form.reset({
      name: '',
      categoryId: 0,
      amount: 0,
      paymentMethodId: 0,
      date: defaultDate,
      isPaid: false,
      isRecurring: false,
      applyToBothFortnights: false,
    });
  }, [open, fortnight, form]);

  useEffect(() => {
    if (!isCreditCardPaymentMethod) {
      return;
    }

    if (!form.getValues('isPaid')) {
      form.setValue('isPaid', true);
    }
  }, [form, isCreditCardPaymentMethod]);

  const handleSubmit = async (values: AddExpenseFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
    }
    onOpenChange(nextOpen);
  };

  const expenseCategories = categories;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar gasto — {fortnight.label}</DialogTitle>
          <DialogDescription>
            Crea un nuevo gasto rápido para este periodo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
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
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        field.onChange(parseInt(event.target.value, 10))
                      }
                      onBlur={field.onBlur}
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecciona una categoría</option>
                      {expenseCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {formatCategoryLabel(category.name, category.icon)}
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
                      onChange={(event) => {
                        const next = event.target.value;
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
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                        field.onChange(parseInt(event.target.value, 10))
                      }
                      onBlur={field.onBlur}
                      disabled={loading}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecciona un método de pago</option>
                      {paymentMethods.map((paymentMethod) => (
                        <option key={paymentMethod.id} value={paymentMethod.id}>
                          {`${getWalletProviderOption(paymentMethod.provider_icon_key)?.shortLabel ?? '•'} ${paymentMethod.name}`}
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || loading || exceedsCreditLimit}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
