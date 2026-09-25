'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { paidExpenseExceedsWalletBalance } from '@/lib/finance/expense-wallet-balance';
import {
  InsufficientWalletExpenseDialog,
  InsufficientWalletExpenseNotice,
} from '@/components/expenses/insufficient-wallet-expense';
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
  const selectedWalletId = form.watch('paymentMethodId');
  const selectedAmount = form.watch('amount');
  const [confirmWithoutDelta, setConfirmWithoutDelta] = useState(false);
  const acceptWithoutDeltaRef = useRef(false);
  const preview = useMemo(
    () => fortnightPreviewLabel(dateValue || todayCalendarDate()),
    [dateValue],
  );

  const expenseWallets = useMemo(
    () =>
      paymentMethods.filter(
        (pm) =>
          !isGoalWalletType(pm.type) &&
          (pm.type === 'CASH' || pm.type === 'DEBIT_CARD'),
      ),
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

  useEffect(() => {
    if (!open || loading) return;
    const current = form.getValues('paymentMethodId');
    if (current != null && current > 0) return;
    if (expenseWallets.length !== 1) return;
    form.setValue('paymentMethodId', expenseWallets[0].id, {
      shouldValidate: true,
    });
  }, [open, loading, expenseWallets, form]);

  const selectedWallet = useMemo(
    () => expenseWallets.find((pm) => pm.id === Number(selectedWalletId)),
    [expenseWallets, selectedWalletId],
  );
  const fundingBalance = Number(selectedWallet?.amount ?? 0);
  const exceedsFundingBalance =
    Boolean(applyWalletDelta) &&
    paidExpenseExceedsWalletBalance({
      walletType: selectedWallet?.type,
      balance: fundingBalance,
      amount: Number(selectedAmount || 0),
      isPaid: Boolean(isPaid),
    });

  const handleSubmit = form.handleSubmit(async (values) => {
    if (exceedsFundingBalance && !acceptWithoutDeltaRef.current) {
      setConfirmWithoutDelta(true);
      return;
    }
    acceptWithoutDeltaRef.current = false;
    try {
      setSubmitting(true);
      await onSave({
        ...values,
        applyWalletDelta: exceedsFundingBalance ? false : values.applyWalletDelta,
      });
      setConfirmWithoutDelta(false);
    } finally {
      setSubmitting(false);
    }
  });

  const walletHint =
    expenseWallets.length === 0
      ? 'Necesitas una billetera de efectivo o débito.'
      : 'De aquí sale el gasto. Si hay varias, elige una; no se asigna sola.';

  return (
    <>
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar gasto"
      description="La fecha elige la quincena. Puedes planificar o marcar como pagado."
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
                  const selected = expenseWallets.find(
                    (pm) => pm.id === Number(field.value),
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
                      ariaLabel="Categoría"
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
                          placeholder="Ej. doctor, Oxxo"
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

            <p className="px-1 text-xs text-muted-foreground">{walletHint}</p>

            {exceedsFundingBalance && selectedWallet ? (
              <InsufficientWalletExpenseNotice
                walletName={selectedWallet.name}
                balance={fundingBalance}
                amount={Number(selectedAmount || 0)}
              />
            ) : null}

            <ToggleField
              layout="row"
              className="px-3"
              label="¿Ya se pagó?"
              helper={
                isPaid
                  ? 'Se descuenta de la billetera elegida'
                  : 'Queda planificado en esa quincena; la billetera no se mueve hasta pagarlo'
              }
              checked={Boolean(isPaid)}
              onCheckedChange={(checked) => form.setValue('isPaid', checked)}
              disabled={loading || submitting}
              aria-label="Gasto pagado"
            />

            {isPaid ? (
              <ToggleField
                layout="row"
                className="px-3"
                label="Descontar de la cartera"
                helper={
                  applyWalletDelta
                    ? 'Se restará del saldo. Apaga esto si el saldo ya incluye el pago.'
                    : 'El saldo ya está al día: solo se registra el gasto.'
                }
                checked={Boolean(applyWalletDelta)}
                onCheckedChange={(checked) =>
                  form.setValue('applyWalletDelta', checked)
                }
                disabled={loading || submitting}
                aria-label="Descontar de la cartera"
              />
            ) : null}

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
    <InsufficientWalletExpenseDialog
      open={confirmWithoutDelta}
      onOpenChange={setConfirmWithoutDelta}
      walletName={selectedWallet?.name ?? 'La billetera'}
      balance={fundingBalance}
      amount={Number(selectedAmount || 0)}
      busy={submitting}
      onAccept={() => {
        acceptWithoutDeltaRef.current = true;
        void handleSubmit();
      }}
    />
    </>
  );
}
