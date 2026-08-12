'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  AlertCircle,
  Loader2,
  Banknote,
  Landmark,
  CreditCard,
  Store,
  CalendarDays,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
import {
  walletSchema,
  WalletFormValues,
  WalletFormInput,
} from '@/schemas/wallet.schema';
import { cn } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { WALLET_PROVIDER_ICON_OPTIONS } from '@/lib/wallet-provider-icons';
import MemberAssigneeSelect from '@/components/assignee/MemberAssigneeSelect';

type TypeMeta = {
  label: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
};

const TYPE_META: Record<WalletFormValues['type'], TypeMeta> = {
  CASH: {
    label: 'Efectivo',
    icon: Banknote,
    accent: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
  },
  DEBIT_CARD: {
    label: 'Tarjeta de débito',
    icon: Landmark,
    accent: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
  },
  CREDIT_CARD: {
    label: 'Tarjeta de crédito',
    icon: CreditCard,
    accent: 'text-slate-700 dark:text-slate-300',
    iconBg: 'bg-slate-500/10 dark:bg-slate-500/15',
  },
  DEPARTMENT_STORE_CARD: {
    label: 'Tienda departamental',
    icon: Store,
    accent: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
  GOAL: {
    label: 'Meta',
    icon: Target,
    accent: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-600/10 dark:bg-blue-500/15',
  },
};

type WalletFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: WalletFormValues) => Promise<void>;
  defaultValues?: WalletFormValues;
  mode: 'create' | 'edit';
  error?: string | null;
  allowedTypes?: WalletFormValues['type'][];
  showAmountField?: boolean;
};

const toNumericOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toNumericAmount = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const buildWalletFormDefaults = (
  mode: 'create' | 'edit',
  defaultValues?: WalletFormValues,
): WalletFormInput => ({
  name: defaultValues?.name ?? '',
  amount: toNumericAmount(defaultValues?.amount),
  credit_limit: toNumericOrNull(defaultValues?.credit_limit),
  temporary_credit_limit: toNumericOrNull(defaultValues?.temporary_credit_limit),
  type: defaultValues?.type ?? 'CASH',
  provider_icon_key: defaultValues?.provider_icon_key ?? null,
  active: defaultValues?.active ?? true,
  include_in_liquidity: defaultValues?.include_in_liquidity ?? true,
  cutoff_day: toNumericOrNull(defaultValues?.cutoff_day),
  due_day: toNumericOrNull(defaultValues?.due_day),
  goal_amount: toNumericOrNull(defaultValues?.goal_amount),
  goal_due_date: defaultValues?.goal_due_date ?? null,
  assignee_user_id: defaultValues?.assignee_user_id ?? null,
});

export default function WalletForm({
  open,
  onOpenChange,
  onSave,
  defaultValues,
  mode,
  error,
  allowedTypes,
  showAmountField = true,
}: WalletFormProps) {
  const form = useForm<WalletFormInput>({
    resolver: zodResolver(walletSchema),
    defaultValues: buildWalletFormDefaults(mode, defaultValues),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(buildWalletFormDefaults(mode, defaultValues));
    // Reset when the dialog opens only; `defaultValues` is often a new object each parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, form]);

  const handleSubmit = async (data: WalletFormInput) => {
    const parsedData = walletSchema.parse(data);
    await onSave(parsedData);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && form.formState.isSubmitting) return;
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const type = useWatch({
    control: form.control,
    name: 'type',
  });

  const typeOptions = allowedTypes ?? [
    'CASH',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'DEPARTMENT_STORE_CARD',
  ];

  const isCreditType =
    type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD';
  const isGoalType = type === 'GOAL';
  const lockType = typeOptions.length === 1;

  const currentMeta = TYPE_META[type] ?? TYPE_META.CASH;
  const HeaderIcon = currentMeta.icon;
  const isSubmitting = form.formState.isSubmitting;

  const dialogTitle = isGoalType
    ? mode === 'create'
      ? 'Nueva meta'
      : 'Editar meta'
    : mode === 'create'
      ? 'Nueva billetera'
      : 'Editar billetera';
  const dialogDescription = isGoalType
    ? mode === 'create'
      ? 'Define nombre, monto objetivo y fecha límite.'
      : 'Actualiza los datos de esta meta.'
    : mode === 'create'
      ? 'Define nombre, tipo y saldo inicial.'
      : 'Actualiza los datos de esta billetera.';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 border-border/60 p-5 shadow-md sm:max-w-md sm:p-6">
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-start gap-3 pr-6">
            <span
              className={cn(
                'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-border/50',
                currentMeta.iconBg,
              )}
              aria-hidden
            >
              <HeaderIcon
                className={cn('h-5 w-5', currentMeta.accent)}
                data-icon="inline-start"
              />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-left text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {dialogTitle}
              </DialogTitle>
              <DialogDescription className="text-left text-sm text-muted-foreground">
                {dialogDescription}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {error ? (
              <div
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                role="alert"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden
                  data-icon="inline-start"
                />
                <span className="min-w-0">{error}</span>
              </div>
            ) : null}

            <div
              className={cn(
                'grid items-start gap-3',
                isGoalType
                  ? 'grid-cols-1'
                  : 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,4fr)_minmax(4.5rem,1fr)]',
              )}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          isGoalType
                            ? 'Ej. Viaje, Auto, TV…'
                            : 'Ej. Banorte, Efectivo…'
                        }
                        className="h-10"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isGoalType ? (
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="space-y-0 pt-0.5">
                      <ToggleField
                        layout="stack"
                        label="Estado"
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                        aria-label="Billetera activa"
                      />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            {!isGoalType || !lockType ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {!lockType ? (
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>Tipo de billetera</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger
                            className="h-10 w-full"
                            aria-label="Tipo de billetera"
                          >
                            <SelectValue placeholder="Selecciona un tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {typeOptions.map((value) => {
                              const meta = TYPE_META[value];
                              const Icon = meta.icon;
                              return (
                                <SelectItem key={value} value={value}>
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                        meta.iconBg,
                                      )}
                                    >
                                      <Icon
                                        className={cn('h-3 w-3', meta.accent)}
                                        data-icon="inline-start"
                                      />
                                    </span>
                                    {meta.label}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {!isGoalType ? (
              <FormField
                control={form.control}
                name="provider_icon_key"
                render={({ field }) => (
                  <FormItem className={cn('min-w-0', lockType && 'sm:col-span-2')}>
                    <FormLabel>Empresa o banco</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(value === '__none__' ? null : value)
                        }
                        value={field.value ?? '__none__'}
                      >
                        <SelectTrigger
                          className="h-10 w-full"
                          aria-label="Empresa o banco de la billetera"
                        >
                          <SelectValue placeholder="Selecciona un proveedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">
                              Sin asignar
                            </span>
                          </SelectItem>
                          {WALLET_PROVIDER_ICON_OPTIONS.map((provider) => (
                            <SelectItem key={provider.key} value={provider.key}>
                              <span className="flex items-center gap-2">
                                <WalletProviderIcon
                                  providerIconKey={provider.key}
                                  className="h-5 w-5 rounded-md border-0"
                                  showTooltipLabel={false}
                                />
                                {provider.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              ) : null}
            </div>
            ) : null}

            {showAmountField && !isGoalType ? (
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => {
                  const numericValue =
                    field.value === undefined ||
                    field.value === null ||
                    field.value === ''
                      ? ''
                      : Number(field.value);

                  return (
                    <FormItem>
                      <FormLabel>
                        {isCreditType ? 'Saldo utilizado' : 'Saldo'}
                      </FormLabel>
                      <FormControl>
                        <CurrencyInput
                          className="h-11 font-mono text-base tabular-nums"
                          value={numericValue === '' ? 0 : numericValue}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="0.00"
                          aria-label={
                            isCreditType ? 'Saldo utilizado' : 'Saldo'
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            ) : null}

            {isGoalType ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <FormField
                  control={form.control}
                  name="goal_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto objetivo</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          className="h-10 font-mono tabular-nums"
                          value={
                            field.value == null || field.value === ''
                              ? 0
                              : Number(field.value)
                          }
                          onChange={(val) =>
                            field.onChange(val === 0 ? null : val)
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="0.00"
                          aria-label="Monto objetivo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="goal_due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha límite</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="h-10"
                          value={
                            typeof field.value === 'string' ? field.value : ''
                          }
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? null : e.target.value,
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          aria-label="Fecha límite de la meta"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {!isCreditType && !isGoalType ? (
              <FormField
                control={form.control}
                name="include_in_liquidity"
                render={({ field }) => (
                  <FormItem className="space-y-0 border-t border-border/60 pt-3">
                    <ToggleField
                      layout="row"
                      label="Incluir en liquidez"
                      helper="Cuenta en el saldo de Liquidez (efectivo + débito)."
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      aria-label="Incluir en liquidez"
                    />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="assignee_user_id"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="space-y-1">
                      <MemberAssigneeSelect
                        id="micasa-wallet-assignee"
                        value={field.value ?? ''}
                        onChange={(userId) =>
                          field.onChange(userId === '' ? null : userId)
                        }
                        label="Asignar a miembro (opcional)"
                      />
                      <p className="pl-0.5 text-[10px] text-muted-foreground">
                        En la casa: deja vacío para una billetera compartida.
                      </p>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isCreditType ? (
              <div className="space-y-4 border-t border-border/60 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Datos de crédito
                </p>

                <FormField
                  control={form.control}
                  name="credit_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Línea de crédito</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          className="h-10 font-mono tabular-nums"
                          value={
                            field.value == null || field.value === ''
                              ? 0
                              : Number(field.value)
                          }
                          onChange={(val) =>
                            field.onChange(val === 0 ? null : val)
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="0.00"
                          aria-label="Línea de crédito"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temporary_credit_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite temporal (opcional)</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          className="h-10 font-mono tabular-nums"
                          aria-label="Límite temporal promocional"
                          value={
                            field.value == null || field.value === ''
                              ? 0
                              : Number(field.value)
                          }
                          onChange={(val) =>
                            field.onChange(val === 0 ? null : val)
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <p className="pl-0.5 text-[10px] text-muted-foreground">
                        Promoción por encima de tu línea (p. ej. DiDi). Vacío
                        quita el tope extra.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="cutoff_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <CalendarDays
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Día de corte
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            step="1"
                            className="h-10"
                            placeholder="1–31"
                            value={
                              field.value == null || field.value === ''
                                ? ''
                                : Number(field.value)
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <CalendarDays
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden
                            data-icon="inline-start"
                          />
                          Día de pago
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            step="1"
                            className="h-10"
                            placeholder="1–31"
                            value={
                              field.value == null || field.value === ''
                                ? ''
                                : Number(field.value)
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ) : null}

            <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-muted-foreground"
                disabled={isSubmitting}
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 min-w-[9rem] rounded-xl"
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                      data-icon="inline-start"
                    />
                    {mode === 'create' ? 'Creando…' : 'Guardando…'}
                  </>
                ) : mode === 'create' ? (
                  isGoalType ? 'Crear meta' : 'Crear billetera'
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
