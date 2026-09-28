'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  Banknote,
  Landmark,
  CreditCard,
  Store,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
import { useFinanceContext } from '@/context/finance-context';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  FieldClearButton,
  FormAmountRow,
  FormGroupedRow,
  OptionalDateStepper,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_NUMBER_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OverlayErrorBanner,
  OverlayHint,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';

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
    accent: 'text-status-income',
    iconBg: 'bg-status-income/10 dark:bg-status-income/15',
  },
  DEBIT_CARD: {
    label: 'Tarjeta de débito',
    icon: Landmark,
    accent: 'text-status-info',
    iconBg: 'bg-status-info/10 dark:bg-status-info/15',
  },
  CREDIT_CARD: {
    label: 'Tarjeta de crédito',
    icon: CreditCard,
    accent: 'text-status-info',
    iconBg: 'bg-status-info-soft',
  },
  DEPARTMENT_STORE_CARD: {
    label: 'Tienda departamental',
    icon: Store,
    accent: 'text-status-pending',
    iconBg: 'bg-status-pending/10 dark:bg-status-pending/15',
  },
  GOAL: {
    label: 'Meta',
    icon: Target,
    accent: 'text-status-info',
    iconBg: 'bg-status-info/10 dark:bg-status-info/15',
  },
};

type WalletFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: WalletFormValues) => Promise<void>;
  defaultValues?: Partial<WalletFormValues>;
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

const percentFromRate = (value: unknown): number | null => {
  const rate = toNumericOrNull(value);
  if (rate == null || rate <= 0) return null;
  return Math.round(rate * 10000) / 100;
};

const rateFromPercent = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round((value / 100) * 1_000_000) / 1_000_000;
};

const buildWalletFormDefaults = (
  mode: 'create' | 'edit',
  defaultValues?: Partial<WalletFormValues>,
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
  minimum_payment: toNumericOrNull(defaultValues?.minimum_payment),
  apr_annual: toNumericOrNull(defaultValues?.apr_annual),
  cat_annual: toNumericOrNull(defaultValues?.cat_annual),
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
  const { context } = useFinanceContext();
  const isHouseContext = context.type === 'house';

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

  const handleRootOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (data: WalletFormInput) => {
    const parsedData = walletSchema.parse(data);
    await onSave(parsedData);
    form.reset();
    onOpenChange(false);
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
  const isSubmitting = form.formState.isSubmitting;

  const dialogTitle = isGoalType
    ? mode === 'create'
      ? 'Agregar meta'
      : 'Editar meta'
    : mode === 'create'
      ? 'Agregar billetera'
      : 'Editar billetera';
  const dialogDescription = isGoalType
    ? mode === 'create'
      ? 'Define nombre, monto objetivo y fecha límite.'
      : 'Actualiza los datos de esta meta.'
    : mode === 'create'
      ? 'Define nombre, tipo y saldo inicial.'
      : 'Actualiza los datos de esta billetera.';

  const submitLabel = isSubmitting
    ? mode === 'create'
      ? 'Creando…'
      : 'Guardando…'
    : mode === 'create' ? (
    isGoalType ? (
      'Agregar meta'
    ) : (
      'Agregar billetera'
    )
  ) : (
    'Guardar cambios'
  );

  const renderSecondaryAmount = (
    name:
      | 'credit_limit'
      | 'temporary_credit_limit'
      | 'minimum_payment',
    label: string,
    ariaLabel: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormGroupedRow label={label}>
          <FormControl>
            <CurrencyInput
              hideSymbol
              className={OVERLAY_ROW_NUMBER_INPUT_CLASS}
              value={
                field.value == null || field.value === ''
                  ? 0
                  : Number(field.value)
              }
              onChange={(val) => field.onChange(val === 0 ? null : val)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              placeholder="0.00"
              enterKeyHint="next"
              aria-label={ariaLabel}
            />
          </FormControl>
        </FormGroupedRow>
      )}
    />
  );

  const renderDayField = (
    name: 'cutoff_day' | 'due_day',
    label: string,
    ariaLabel: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormGroupedRow label={label}>
          <FormControl>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              step="1"
              className={OVERLAY_ROW_NUMBER_INPUT_CLASS}
              placeholder="1–31"
              aria-label={ariaLabel}
              value={
                field.value == null || field.value === ''
                  ? ''
                  : Number(field.value)
              }
              onChange={(e) =>
                field.onChange(
                  e.target.value === '' ? null : Number(e.target.value),
                )
              }
            />
          </FormControl>
        </FormGroupedRow>
      )}
    />
  );

  const renderPercentField = (
    name: 'apr_annual' | 'cat_annual',
    label: string,
    ariaLabel: string,
    placeholder: string,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormGroupedRow label={label}>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={500}
              step="0.01"
              className={OVERLAY_ROW_NUMBER_INPUT_CLASS}
              aria-label={ariaLabel}
              placeholder={placeholder}
              value={percentFromRate(field.value) ?? ''}
              onChange={(event) =>
                field.onChange(
                  rateFromPercent(
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                  ),
                )
              }
            />
          </FormControl>
        </FormGroupedRow>
      )}
    />
  );

  const renderFormBody = (
    handleSelectOpenChange: (nextOpen: boolean) => void,
  ) => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-3"
      >
        {error ? <OverlayErrorBanner>{error}</OverlayErrorBanner> : null}

        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormGroupedRow label="Nombre">
                <div className="flex items-center gap-1">
                  <FormControl>
                    <Input
                      placeholder={
                        isGoalType
                          ? 'Ej. Viaje, Auto, TV…'
                          : 'Ej. Banorte, Efectivo…'
                      }
                      className={OVERLAY_ROW_INPUT_CLASS}
                      autoCapitalize="sentences"
                      autoComplete="off"
                      enterKeyHint="next"
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

          {!lockType ? (
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormGroupedRow label="Tipo">
                  <Select
                    onValueChange={field.onChange}
                    onOpenChange={handleSelectOpenChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={OVERLAY_ROW_TRIGGER_CLASS}
                        aria-label="Tipo de billetera"
                      >
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                    </FormControl>
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
                </FormGroupedRow>
              )}
            />
          ) : null}

          {!isGoalType ? (
            <FormField
              control={form.control}
              name="provider_icon_key"
              render={({ field }) => (
                <FormGroupedRow label="Banco">
                  <Select
                    onValueChange={(value) =>
                      field.onChange(value === '__none__' ? null : value)
                    }
                    onOpenChange={handleSelectOpenChange}
                    value={field.value ?? '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger
                        className={OVERLAY_ROW_TRIGGER_CLASS}
                        aria-label="Empresa o banco de la billetera"
                      >
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                    </FormControl>
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
                </FormGroupedRow>
              )}
            />
          ) : null}

          {isGoalType ? (
            <>
              <FormField
                control={form.control}
                name="goal_amount"
                render={({ field }) => (
                  <FormAmountRow
                    label="Monto objetivo"
                    value={field.value == null ? 0 : field.value}
                    onChange={(val) => field.onChange(val === 0 ? null : val)}
                  />
                )}
              />
              <FormField
                control={form.control}
                name="goal_due_date"
                render={({ field }) => (
                  <FormGroupedRow label="Fecha límite">
                    <OptionalDateStepper
                      label="Fecha límite"
                      value={typeof field.value === 'string' && field.value ? field.value : null}
                      onChange={field.onChange}
                    />
                  </FormGroupedRow>
                )}
              />
            </>
          ) : null}

          {showAmountField && !isGoalType ? (
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormAmountRow
                  label={isCreditType ? 'Saldo utilizado' : 'Saldo'}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          ) : null}

          {isHouseContext ? (
            <FormField
              control={form.control}
              name="assignee_user_id"
              render={({ field }) => (
                <FormGroupedRow label="Miembro">
                  <FormControl>
                    <MemberAssigneeSelect
                      id="micasa-wallet-assignee"
                      hideLabel
                      label="Asignar a miembro (opcional)"
                      triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
                      value={field.value ?? ''}
                      onChange={(userId) =>
                        field.onChange(userId === '' ? null : userId)
                      }
                      onOpenChange={handleSelectOpenChange}
                    />
                  </FormControl>
                </FormGroupedRow>
              )}
            />
          ) : null}
        </div>

        {isHouseContext ? (
          <OverlayHint>
            {isGoalType
              ? 'Miembro opcional. Déjalo vacío para una meta compartida.'
              : 'Miembro opcional. Déjalo vacío para una billetera compartida.'}
          </OverlayHint>
        ) : null}

        {isCreditType ? (
          <>
            <OverlaySectionLabel>Datos de crédito</OverlaySectionLabel>
            <div className={OVERLAY_GROUPED_CARD_CLASS}>
              {renderSecondaryAmount('credit_limit', 'Línea', 'Línea de crédito')}
              {renderSecondaryAmount(
                'temporary_credit_limit',
                'Temporal',
                'Límite temporal promocional',
              )}
              {renderDayField('cutoff_day', 'Día corte', 'Día de corte')}
              {renderDayField('due_day', 'Día pago', 'Día de pago')}
              {mode === 'edit' ? (
                <>
                  {renderSecondaryAmount('minimum_payment', 'Pago mín.', 'Pago mínimo')}
                  {renderPercentField('apr_annual', 'APR %', 'APR anual en porcentaje', '42')}
                  {renderPercentField('cat_annual', 'CAT %', 'CAT anual en porcentaje', '55')}
                </>
              ) : null}
            </div>
            <OverlayHint>
              Temporal: promoción por encima de tu línea (p. ej. DiDi); vacío
              quita el tope extra.
              {mode === 'edit'
                ? ' Pago mínimo es lo que pide el banco, no el pago para no generar intereses. APR y CAT son anuales; déjalos vacíos si no los tienes.'
                : ''}
            </OverlayHint>
          </>
        ) : null}

        {!isGoalType ? (
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <ToggleField
                  layout="row"
                  className="px-3"
                  label="Activa"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  aria-label="Billetera activa"
                />
              </FormItem>
            )}
          />
        ) : null}

        {!isCreditType && !isGoalType ? (
          <FormField
            control={form.control}
            name="include_in_liquidity"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <ToggleField
                  layout="row"
                  className="px-3"
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

        <Button
          type="submit"
          disabled={isSubmitting}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {submitLabel}
        </Button>
      </form>
    </Form>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleRootOpenChange}
      title={dialogTitle}
      description={dialogDescription}
      busy={isSubmitting}
    >
      {({ handleSelectOpenChange }) =>
        open ? renderFormBody(handleSelectOpenChange) : null
      }
    </ResponsiveOverlay>
  );
}
