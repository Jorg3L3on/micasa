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
import {
  createOverrideAmountFormSchema,
  OverrideAmountFormValues,
} from '@/schemas/fortnight.schema';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { useFinanceContext } from '@/context/finance-context';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
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
  /** Cash/debit wallet is required when editing a stored income. */
  requireWallet?: boolean;
  defaultWalletId?: number | null;
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
  requireWallet = false,
  defaultWalletId = null,
}: EditFortnightAmountDialogProps) {
  const { context } = useFinanceContext();
  const [fundingWallets, setFundingWallets] = useState<PaymentMethodOption[]>(
    [],
  );
  const [walletsLoading, setWalletsLoading] = useState(false);

  const schema = useMemo(
    () =>
      createOverrideAmountFormSchema({
        requireCategory,
        requireWallet,
      }),
    [requireCategory, requireWallet],
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
    requireWallet,
  ]);

  useEffect(() => {
    if (!open || !requireWallet) return;
    let cancelled = false;
    const loadWallets = async () => {
      try {
        setWalletsLoading(true);
        const methods = await getPaymentMethodOptions(context);
        if (cancelled) return;
        const funding = methods.filter(
          (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
        );
        setFundingWallets(funding);
        const current = form.getValues('walletId');
        const currentIsFunding = funding.some((wallet) => wallet.id === current);
        if (!currentIsFunding) {
          form.setValue(
            'walletId',
            funding.length === 1 ? funding[0].id : undefined,
            { shouldValidate: funding.length === 1 },
          );
        }
      } catch (err) {
        console.error('Error fetching funding wallets:', err);
        if (!cancelled) setFundingWallets([]);
      } finally {
        if (!cancelled) setWalletsLoading(false);
      }
    };
    void loadWallets();
    return () => {
      cancelled = true;
    };
  }, [open, requireWallet, context, form]);

  const handleSubmit = async (data: OverrideAmountFormValues) => {
    await onSave(data);
    onOpenChange(false);
  };

  const selectedWalletId = form.watch('walletId');

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      title={requireWallet ? 'Modificar ingreso' : 'Modificar ingresos'}
      description={
        requireWallet
          ? `Actualiza el monto y la billetera de efectivo o débito. Quincena: ${fortnightLabel}.`
          : `Modificar ingresos de ${fortnightLabel}. Monto actual: ${formatCurrency(defaultAmount)}. Este monto solo aplica a esta quincena.`
      }
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
              {requireWallet ? (
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
                          disabled={walletsLoading}
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
            </div>
            {requireWallet ? (
              <p className="px-1 text-xs text-muted-foreground">
                {fundingWallets.length === 0 && !walletsLoading
                  ? 'No hay billeteras de efectivo o débito. Crea una en Billeteras antes de guardar.'
                  : 'Elige la billetera de efectivo o débito donde entra este ingreso.'}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={
                form.formState.isSubmitting ||
                (requireWallet &&
                  (walletsLoading ||
                    fundingWallets.length === 0 ||
                    selectedWalletId == null ||
                    selectedWalletId <= 0))
              }
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
