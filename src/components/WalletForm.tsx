'use client';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  Loader2,
  Banknote,
  Landmark,
  CreditCard,
  Store,
  CalendarDays,
  DollarSign,
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  walletSchema,
  WalletFormValues,
  WalletFormInput,
} from '@/schemas/wallet.schema';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { WALLET_PROVIDER_ICON_OPTIONS } from '@/lib/wallet-provider-icons';

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
    accent: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
  },
  DEPARTMENT_STORE_CARD: {
    label: 'Tienda departamental',
    icon: Store,
    accent: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
};

type WalletFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WalletFormValues) => Promise<void>;
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
  type: defaultValues?.type ?? 'CASH',
  provider_icon_key: defaultValues?.provider_icon_key ?? null,
  active: defaultValues?.active ?? true,
  cutoff_day: toNumericOrNull(defaultValues?.cutoff_day),
  due_day: toNumericOrNull(defaultValues?.due_day),
});

export default function WalletForm({
  open,
  onOpenChange,
  onSubmit,
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
  }, [open, mode, form]);

  const handleSubmit = async (data: WalletFormInput) => {
    const parsedData = walletSchema.parse(data);
    await onSubmit(parsedData);
    form.reset();
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
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

  const currentMeta = TYPE_META[type] ?? TYPE_META.CASH;
  const HeaderIcon = currentMeta.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                currentMeta.iconBg,
              )}
            >
              <HeaderIcon className={cn('h-4.5 w-4.5', currentMeta.accent)} />
            </span>
            <div>
              <DialogTitle className="text-base">
                {mode === 'create' ? 'Nueva billetera' : 'Editar billetera'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {mode === 'create'
                  ? 'Crea una nueva cartera para tus transacciones.'
                  : 'Actualiza la información de la cartera.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5 pt-1"
          >
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <span className="shrink-0 text-destructive">!</span>
                {error}
              </div>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Banorte, Efectivo…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 pb-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Billetera activa"
                      />
                    </FormControl>
                    <FormLabel className="mt-0! text-xs text-muted-foreground cursor-pointer">
                      Activa
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de billetera</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger aria-label="Tipo de billetera">
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
                                    'flex h-5 w-5 items-center justify-center rounded-md shrink-0',
                                    meta.iconBg,
                                  )}
                                >
                                  <Icon
                                    className={cn('h-3 w-3', meta.accent)}
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

            <FormField
              control={form.control}
              name="provider_icon_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa o banco</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === '__none__' ? null : value)
                      }
                      value={field.value ?? '__none__'}
                    >
                      <SelectTrigger aria-label="Empresa o banco de la billetera">
                        <SelectValue placeholder="Selecciona un proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">Sin asignar</span>
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

            {showAmountField && (
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
                        {isCreditType ? 'Saldo actual' : 'Monto'}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            $
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="pl-7 font-mono tabular-nums"
                            value={numericValue}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            {isCreditType && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15 shrink-0">
                    <DollarSign className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Datos de crédito
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="credit_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Línea de crédito</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                            $
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="pl-7 font-mono tabular-nums"
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
                        </div>
                      </FormControl>
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
                          <CalendarDays className="h-3 w-3 text-muted-foreground" />
                          Día de corte
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            step="1"
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
                          <CalendarDays className="h-3 w-3 text-muted-foreground" />
                          Día de pago
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            step="1"
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
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'create' ? 'Creando…' : 'Guardando…'}
                  </>
                ) : mode === 'create' ? (
                  'Crear billetera'
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
