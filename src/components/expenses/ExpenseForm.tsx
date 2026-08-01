'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  addExpenseSchema,
  AddExpenseFormValues,
} from '@/schemas/transaction.schema';
import type {
  CategoryOption,
  PaymentMethodOption,
} from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency } from '@/lib/utils';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';

export type ExpenseFormProps = {
  mode: 'create' | 'edit';
  defaults?: Partial<AddExpenseFormValues>;
  onSave: (values: AddExpenseFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  error?: string | null;
  submitLabel?: string;
  showRecurringFields?: boolean;
};

function getFallbackDate(): string {
  return todayCalendarDate();
}

export default function ExpenseForm({
  mode,
  defaults,
  onSave,
  onCancel,
  onDelete,
  error,
  submitLabel,
  showRecurringFields = true,
}: ExpenseFormProps) {
  const { context } = useFinanceContext();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
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
  const selectedPaymentMethodId = form.watch('paymentMethodId');
  const selectedAmount = form.watch('amount');

  useEffect(() => {
    let cancelled = false;
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
        if (cancelled) return;
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);
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

  const isFundingPaymentMethod =
    selectedPaymentMethod?.type === 'CASH' ||
    selectedPaymentMethod?.type === 'DEBIT_CARD';

  const isPaidWatch = form.watch('isPaid');

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

  const fundingBalance = Number(selectedPaymentMethod?.amount ?? 0);
  const exceedsFundingBalance =
    isFundingPaymentMethod &&
    isPaidWatch &&
    Number.isFinite(fundingBalance) &&
    Number(selectedAmount || 0) > fundingBalance + 1e-9;

  useEffect(() => {
    if (!isCreditCardPaymentMethod) return;
    if (!form.getValues('isPaid')) {
      form.setValue('isPaid', true);
    }
  }, [form, isCreditCardPaymentMethod]);

  const handleSubmit = async (values: AddExpenseFormValues) => {
    try {
      setIsSubmitting(true);
      await onSave(values);
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
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0.00"
                  aria-label="Monto"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="paymentMethodId"
          render={({ field }) => {
            const selectedMethod = paymentMethods.find(
              (pm) => pm.id === Number(field.value),
            );
            return (
              <FormItem>
                <FormLabel>Método de pago</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(value) =>
                    field.onChange(parseInt(value, 10))
                  }
                  disabled={loading}
                >
                  <FormControl>
                    <SelectTrigger
                      className="h-11 w-full max-w-none"
                      aria-label="Método de pago"
                    >
                      <SelectValue placeholder="Selecciona un método de pago">
                        {selectedMethod ? (
                          <span className="flex w-full items-center justify-between gap-3">
                            <WalletIdentity
                              name={selectedMethod.name}
                              providerIconKey={selectedMethod.provider_icon_key}
                              iconClassName="h-5 w-5 rounded-md"
                            />
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {formatCurrency(selectedMethod.amount ?? 0)}
                            </span>
                          </span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={String(pm.id)}>
                        <span className="flex items-center justify-between gap-3">
                          <WalletIdentity
                            name={pm.name}
                            providerIconKey={pm.provider_icon_key}
                            iconClassName="h-5 w-5 rounded-md"
                          />
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatCurrency(pm.amount ?? 0)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
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
          name="categoryId"
          render={({ field }) => {
            const selectedCategory = categories.find(
              (c) => c.id === Number(field.value),
            );
            return (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(value) =>
                    field.onChange(parseInt(value, 10))
                  }
                  disabled={loading}
                >
                  <FormControl>
                    <SelectTrigger
                      className="h-11 w-full max-w-none"
                      aria-label="Categoría"
                    >
                      <SelectValue placeholder="Selecciona una categoría">
                        {selectedCategory ? (
                          <CategoryLabel
                            name={selectedCategory.name}
                            icon={selectedCategory.icon}
                          />
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <CategoryLabel name={c.name} icon={c.icon} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
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
            disabled={
              isSubmitting ||
              isDeleting ||
              loading ||
              exceedsCreditLimit ||
              exceedsFundingBalance
            }
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
