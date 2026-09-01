'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  quickExpenseSchema,
  type QuickExpenseFormValues,
} from '@/schemas/transaction.schema';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { isGoalWalletType } from '@/domain/payment-method';
import { cn, formatCurrency, formatMonth } from '@/lib/utils';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { useIsMobile } from '@/hooks/use-mobile';

type QuickExpenseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: QuickExpenseFormValues) => Promise<void>;
  error?: string | null;
};

const emptyValues = (): QuickExpenseFormValues => ({
  name: '',
  categoryId: 0,
  amount: 0,
  paymentMethodId: null,
  date: todayCalendarDate(),
  isPaid: false,
  applyWalletDelta: true,
});

function fortnightPreviewLabel(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Quincena según la fecha';
  const { year, month, period } = getCalendarFortnightRefForYmd(dateStr);
  const periodLabel =
    period === 'FIRST' ? '1ª quincena' : '2ª quincena';
  const monthLabel = formatMonth(month);
  return `Va a: ${periodLabel} · ${monthLabel} ${year}`;
}

export function QuickExpenseSheet({
  open,
  onOpenChange,
  onSave,
  error,
}: QuickExpenseSheetProps) {
  const isMobile = useIsMobile();
  const { context } = useFinanceContext();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );

  const form = useForm<QuickExpenseFormValues>({
    resolver: zodResolver(quickExpenseSchema) as never,
    defaultValues: emptyValues(),
  });

  const isPaid = form.watch('isPaid');
  const applyWalletDelta = form.watch('applyWalletDelta');
  const dateValue = form.watch('date');
  const preview = useMemo(
    () => fortnightPreviewLabel(dateValue || todayCalendarDate()),
    [dateValue],
  );

  const expenseWallets = useMemo(
    () => paymentMethods.filter((pm) => !isGoalWalletType(pm.type)),
    [paymentMethods],
  );

  useEffect(() => {
    if (!open) return;
    form.reset(emptyValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
        console.error('Error fetching quick expense catalogs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
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

  const formBody = (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-1 px-3 py-2">
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej. doctor, Oxxo"
                    autoComplete="off"
                    disabled={loading || submitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="space-y-1 px-3 py-2">
                <FormLabel>Monto</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    disabled={loading || submitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="space-y-1 px-3 py-2">
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    disabled={loading || submitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem className="space-y-1 px-3 py-2">
                <FormLabel>Categoría</FormLabel>
                <CategoryGroupedSelect
                  categories={categories}
                  value={field.value ? Number(field.value) : undefined}
                  onValueChange={field.onChange}
                  disabled={loading || submitting}
                  includeCategoryId={field.value ? Number(field.value) : null}
                  placeholder="Selecciona"
                  ariaLabel="Categoría"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p
          className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          {preview}
        </p>

        <FormField
          control={form.control}
          name="isPaid"
          render={({ field }) => (
            <ToggleField
              label="¿Ya se pagó?"
              helper={
                field.value
                  ? 'Marca la cartera y si debe descontarse del saldo'
                  : 'Queda planificado en esa quincena; no afecta saldo'
              }
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={loading || submitting}
            />
          )}
        />

        {isPaid ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3">
            <FormField
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => {
                const selected = expenseWallets.find(
                  (pm) => pm.id === Number(field.value),
                );
                return (
                  <FormItem className="space-y-1">
                    <FormLabel>Cartera</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(value) =>
                        field.onChange(parseInt(value, 10))
                      }
                      disabled={loading || submitting}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue placeholder="Selecciona cartera">
                            {selected ? (
                              <WalletIdentity
                                name={selected.name}
                                providerIconKey={selected.provider_icon_key}
                                iconClassName="h-8 w-8 rounded-lg"
                              />
                            ) : null}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {expenseWallets.map((pm) => (
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
              name="applyWalletDelta"
              render={({ field }) => (
                <ToggleField
                  label="Descontar de la cartera"
                  helper={
                    field.value
                      ? 'Se restará del saldo (o sumará a la deuda de tarjeta).'
                      : 'El saldo ya está al día: solo se registra el gasto, sin volver a restar.'
                  }
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  disabled={loading || submitting}
                />
              )}
            />

            <p
              className={cn(
                'text-[10px] leading-snug',
                applyWalletDelta
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-muted-foreground',
              )}
            >
              {applyWalletDelta
                ? 'Si el saldo de la cartera ya refleja este pago, apaga “Descontar” para no restar dos veces.'
                : 'Histórico / catch-up: el gasto queda pagado sin mover el saldo.'}
            </p>
          </div>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting || loading}>
            {submitting ? 'Guardando…' : 'Guardar gasto'}
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
        >
          <div className="border-b border-border/50 p-4 pb-3">
            <SheetTitle>Agregar gasto</SheetTitle>
            <SheetDescription>
              La fecha elige la quincena. Puedes planificar o marcar como pagado.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {formBody}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
        <div className="border-b border-border/50 p-4 pb-3">
          <DialogTitle>Agregar gasto</DialogTitle>
          <DialogDescription>
            La fecha elige la quincena. Puedes planificar o marcar como pagado.
          </DialogDescription>
        </div>
        <div className="p-4">{formBody}</div>
      </DialogContent>
    </Dialog>
  );
}
