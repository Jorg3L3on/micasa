'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
  quickIncomeSchema,
  type QuickIncomeFormValues,
} from '@/schemas/transaction.schema';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { getCalendarFortnightRefForYmd } from '@/lib/fortnight-calendar';
import { isGoalWalletType } from '@/domain/payment-method';
import { formatCurrency, formatMonth } from '@/lib/utils';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
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
  paymentMethodId: null,
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );

  const form = useForm<QuickIncomeFormValues>({
    resolver: zodResolver(quickIncomeSchema) as never,
    defaultValues: emptyValues(),
  });

  const fundingWallets = useMemo(
    () =>
      paymentMethods.filter(
        (pm) =>
          !isGoalWalletType(pm.type) &&
          (pm.type === 'CASH' || pm.type === 'DEBIT_CARD'),
      ),
    [paymentMethods],
  );

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
        const [categoriesData, paymentMethodsData] = await Promise.all([
          clientFetchFromApi<CategoryOption[]>(
            '/api/categories?kind=income',
            undefined,
            context,
          ),
          getPaymentMethodOptions(context),
        ]);
        if (!cancelled) {
          setCategories(categoriesData);
          setPaymentMethods(paymentMethodsData);
        }
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
      description="La fecha elige la quincena. La billetera queda asignada y su saldo no cambia."
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
                name="paymentMethodId"
                render={({ field }) => {
                  const selected = fundingWallets.find(
                    (wallet) => wallet.id === Number(field.value),
                  );
                  return (
                    <FormGroupedRow label="Billetera">
                      <Select
                        value={field.value ? String(field.value) : undefined}
                        onOpenChange={handleSelectOpenChange}
                        onValueChange={(value) =>
                          field.onChange(parseInt(value, 10))
                        }
                        disabled={loading || submitting}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={OVERLAY_ROW_TRIGGER_CLASS}
                            aria-label="Billetera de efectivo o débito"
                          >
                            <SelectValue placeholder="Selecciona">
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
                          {fundingWallets.map((wallet) => (
                            <SelectItem key={wallet.id} value={String(wallet.id)}>
                              <span className="flex items-center justify-between gap-3">
                                <WalletIdentity
                                  name={wallet.name}
                                  providerIconKey={wallet.provider_icon_key}
                                  iconClassName="h-5 w-5 rounded-md"
                                />
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                  {formatCurrency(wallet.amount ?? 0)}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormGroupedRow>
                  );
                }}
              />
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
              Queda en la quincena de esa fecha, asignado a la billetera. El
              saldo no cambia. Para depositarlo, usa Recibir quincena.
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
