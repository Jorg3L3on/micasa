'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  isValidCalendarDateString,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import {
  expenseAmountSchema,
  ExpenseAmountFormValues,
} from '@/schemas/expense.schema';
import type { WalletListItem } from '@/types/catalog';
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

type EditExpenseAmountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ExpenseAmountFormValues) => Promise<void>;
  defaultAmount: number;
  defaultDescription: string;
  defaultPaymentDate?: string | null;
  defaultWalletId?: number | null;
  wallets?: WalletListItem[];
  isPaid?: boolean;
  error?: string | null;
};

const safeAmount = (value: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const resolvePaymentDate = (value?: string | null): string => {
  const ymd = value?.slice(0, 10) ?? '';
  return isValidCalendarDateString(ymd) ? ymd : todayCalendarDate();
};

const NULL_WALLET_VALUE = '__none__';

export default function EditExpenseAmountDialog({
  open,
  onOpenChange,
  onSave,
  defaultAmount,
  defaultDescription,
  defaultPaymentDate,
  defaultWalletId,
  wallets = [],
  isPaid = false,
  error,
}: EditExpenseAmountDialogProps) {
  const initialAmount = safeAmount(defaultAmount);

  const form = useForm<ExpenseAmountFormValues>({
    resolver: zodResolver(expenseAmountSchema),
    defaultValues: {
      amount: initialAmount,
      wallet_id: defaultWalletId ?? null,
      description: defaultDescription,
      payment_date: resolvePaymentDate(defaultPaymentDate),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: safeAmount(defaultAmount),
        wallet_id: defaultWalletId ?? null,
        description: defaultDescription,
        payment_date: resolvePaymentDate(defaultPaymentDate),
      });
    }
  }, [open, defaultAmount, defaultDescription, defaultPaymentDate, defaultWalletId, form]);

  const handleSubmit = async (data: ExpenseAmountFormValues) => {
    try {
      await onSave(data);
    } catch {
      // Parent shows toast and keeps the overlay open.
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title="Modificar gasto"
      description={`Monto actual: ${formatCurrency(initialAmount)}`}
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
                {formatCurrency(initialAmount)}
              </span>
            </p>
            <div className={OVERLAY_GROUPED_CARD_CLASS}>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormGroupedRow label="Nombre">
                    <div className="flex items-center gap-1">
                      <FormControl>
                        <Input
                          placeholder="Ej. café, súper"
                          autoCapitalize="sentences"
                          autoComplete="off"
                          enterKeyHint="next"
                          spellCheck
                          className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                          aria-label="Nombre del gasto"
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
                name="payment_date"
                render={({ field }) => (
                  <FormGroupedRow label="Fecha">
                    <DateStepper
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormGroupedRow>
                )}
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
              {wallets.length > 0 ? (
                <FormField
                  control={form.control}
                  name="wallet_id"
                  render={({ field }) => {
                    const selectedWallet = wallets.find(
                      (w) => w.id === Number(field.value),
                    );
                    return (
                      <FormGroupedRow label="Billetera">
                        <Select
                          disabled={isPaid}
                          value={
                            field.value != null
                              ? String(field.value)
                              : NULL_WALLET_VALUE
                          }
                          onOpenChange={handleSelectOpenChange}
                          onValueChange={(val) => {
                            field.onChange(
                              val === NULL_WALLET_VALUE ? null : Number(val),
                            );
                          }}
                        >
                          <FormControl>
                            <SelectTrigger
                              className={OVERLAY_ROW_TRIGGER_CLASS}
                              aria-label="Billetera"
                            >
                              <SelectValue placeholder="Sin cartera (efectivo)">
                                {selectedWallet ? (
                                  <WalletIdentity
                                    name={selectedWallet.name}
                                    providerIconKey={
                                      selectedWallet.provider_icon_key
                                    }
                                    iconClassName="h-8 w-8 rounded-lg"
                                  />
                                ) : null}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NULL_WALLET_VALUE}>
                              Sin cartera (efectivo)
                            </SelectItem>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)}>
                                <span className="flex items-center justify-between gap-3">
                                  <WalletIdentity
                                    name={w.name}
                                    providerIconKey={w.provider_icon_key}
                                    iconClassName="h-5 w-5 rounded-md"
                                  />
                                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                    {formatCurrency(w.amount ?? 0)}
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
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
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
