'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { isGoalWalletType } from '@/domain/payment-method';
import type { PaymentMethodOption } from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import {
  createOverrideAmountFormSchema,
  OverrideAmountFormValues,
} from '@/schemas/fortnight.schema';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import type { CategoryOption } from '@/types/catalog';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  FormAmountRow,
  FormGroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';

type EditFortnightAmountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: OverrideAmountFormValues) => Promise<void>;
  defaultAmount: number;
  fortnightLabel: string;
  error?: string | null;
  requireCategory?: boolean;
  categories?: CategoryOption[];
  defaultCategoryId?: number | null;
  defaultWalletId?: number | null;
  /** True when this line comes from an income template. */
  updatesIncomeTemplate?: boolean;
};

export default function EditFortnightAmountDialog({
  open,
  onOpenChange,
  onSave,
  defaultAmount,
  fortnightLabel,
  error,
  requireCategory = false,
  categories = [],
  defaultCategoryId = null,
  defaultWalletId = null,
  updatesIncomeTemplate = false,
}: EditFortnightAmountDialogProps) {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<PaymentMethodOption[]>([]);
  const schema = useMemo(
    () =>
      createOverrideAmountFormSchema({
        requireCategory,
        requireWallet: updatesIncomeTemplate,
      }),
    [requireCategory, updatesIncomeTemplate],
  );

  const fundingWallets = useMemo(
    () =>
      wallets.filter(
        (wallet) =>
          !isGoalWalletType(wallet.type) &&
          (wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD'),
      ),
    [wallets],
  );

  const form = useForm<OverrideAmountFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      amount: defaultAmount,
      categoryId: defaultCategoryId ?? undefined,
      walletId: defaultWalletId ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: defaultAmount,
        categoryId: defaultCategoryId ?? undefined,
        walletId: defaultWalletId ?? undefined,
      });
    }
  }, [
    open,
    defaultAmount,
    defaultCategoryId,
    defaultWalletId,
    form,
    requireCategory,
    updatesIncomeTemplate,
  ]);

  useEffect(() => {
    if (!open || !updatesIncomeTemplate) return;
    let cancelled = false;
    getPaymentMethodOptions(context)
      .then((data) => {
        if (!cancelled) setWallets(data);
      })
      .catch(() => {
        if (!cancelled) setWallets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, updatesIncomeTemplate, context]);

  const handleSubmit = async (data: OverrideAmountFormValues) => {
    await onSave(data);
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  const title = updatesIncomeTemplate
    ? 'Modificar plantilla'
    : 'Modificar ingresos';
  const description = updatesIncomeTemplate
    ? 'Cambia el monto, la categoría y la billetera de la plantilla. El saldo no se mueve.'
    : `Modificar ingresos de ${fortnightLabel}. Monto actual: ${formatCurrency(defaultAmount)}. Este monto solo aplica a esta quincena.`;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
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
                {formatCurrency(defaultAmount)}
              </span>
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
              {requireCategory ? (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormGroupedRow label="Categoría">
                      <CategoryGroupedSelect
                        categories={categories}
                        value={
                          field.value != null && field.value > 0
                            ? field.value
                            : undefined
                        }
                        onValueChange={field.onChange}
                        onOpenChange={handleSelectOpenChange}
                        includeCategoryId={
                          field.value != null && field.value > 0
                            ? field.value
                            : defaultCategoryId
                        }
                        placeholder="Selecciona"
                        ariaLabel="Categoría"
                        triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                      />
                    </FormGroupedRow>
                  )}
                />
              ) : null}
              {updatesIncomeTemplate ? (
                <FormField
                  control={form.control}
                  name="walletId"
                  render={({ field }) => {
                    const selected = fundingWallets.find(
                      (wallet) => wallet.id === Number(field.value),
                    );
                    return (
                      <FormGroupedRow label="Billetera">
                        <Select
                          value={
                            field.value != null && field.value > 0
                              ? String(field.value)
                              : undefined
                          }
                          onOpenChange={handleSelectOpenChange}
                          onValueChange={(value) =>
                            field.onChange(parseInt(value, 10))
                          }
                        >
                          <FormControl>
                            <SelectTrigger
                              className={OVERLAY_ROW_TRIGGER_CLASS}
                              aria-label="Billetera de la plantilla"
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
                              <SelectItem
                                key={wallet.id}
                                value={String(wallet.id)}
                              >
                                <WalletIdentity
                                  name={wallet.name}
                                  providerIconKey={wallet.provider_icon_key}
                                  iconClassName="h-5 w-5 rounded-md"
                                />
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
            {updatesIncomeTemplate ? (
              <p className="px-1 text-xs text-muted-foreground">
                La plantilla guarda esta billetera. El saldo no cambia hasta
                que uses Recibir quincena.
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
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
