'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import {
  FieldClearButton,
  FormAmountRow,
  FormGroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OverlayErrorBanner,
  OverlayHint,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import {
  ResponsiveOverlay,
  useOverlaySelectOpenChange,
} from '@/components/overlay/responsive-overlay';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { useFinanceContext } from '@/context/finance-context';
import { isGoalWalletType } from '@/domain/payment-method';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { createExpenseTemplate, updateExpenseTemplate } from '@/lib/api/expense-templates';
import { createIncomeTemplate, updateIncomeTemplate } from '@/lib/api/incomes';
import type { ScheduledKind, ScheduledPeriod } from '@/lib/ui/scheduled-items';
import { cn } from '@/lib/utils';
import type { CategoryOption, WalletListItem } from '@/types/catalog';
import type { FinanceContextType } from '@/types/finance-context';
import { ScheduledDetailBody } from './ScheduledDetailOverlay';
import { ACTIVE_HELPER, DETAIL_TITLE } from './scheduled-detail';
import {
  AMOUNT_HINT,
  cardCutoffHint,
  daySelectOptions,
  expenseFormDefaults,
  expenseFormSchema,
  expensePayload,
  expenseScheduleFor,
  formTitle,
  incomeFormDefaults,
  incomeFormSchema,
  incomePayload,
  isIncomeWalletType,
  SCHEDULE_HINT,
  submitLabel,
  type ExpenseFormValues,
  type IncomeFormValues,
} from './scheduled-form';
import type { ScheduledRowModel } from './scheduled-rows';

/**
 * One overlay for a gasto or ingreso programado (MIC-I16-4): the read-first
 * detail and the create / edit form share it, so Editar swaps the content
 * instead of stacking a second sheet. Dialog from `md`, bottom sheet below.
 */
export type ScheduledOverlayState =
  | { mode: 'detail'; row: ScheduledRowModel }
  | { mode: 'form'; row: ScheduledRowModel | null; fromDetail: boolean };

type ScheduledFormOverlayProps = {
  kind: ScheduledKind;
  state: ScheduledOverlayState | null;
  /** Header Cancelar / Cerrar. */
  onDismiss: () => void;
  /** Detail actions. */
  onActiveChange: (row: ScheduledRowModel, active: boolean) => void;
  savingActive: boolean;
  onEdit: (row: ScheduledRowModel) => void;
  onRequestDelete: (row: ScheduledRowModel) => void;
  /** The form saved; `id` is the item's id (new on create). */
  onSaved: (id: number | null, editing: boolean) => void;
  /** True while the list refreshes after a save. */
  refreshing: boolean;
};

const NO_WALLET = 'none';

export const ScheduledFormOverlay = ({
  kind,
  state,
  onDismiss,
  onActiveChange,
  savingActive,
  onEdit,
  onRequestDelete,
  onSaved,
  refreshing,
}: ScheduledFormOverlayProps) => {
  const { context } = useFinanceContext();
  // Categories and wallets load once per list, so the form opens filled.
  const options = useFormOptions(kind, context);
  const [submitting, setSubmitting] = useState(false);
  const busy = submitting || refreshing;
  const editing = state?.mode === 'form' && state.row !== null;

  const title =
    state?.mode === 'form' ? formTitle(kind, editing) : DETAIL_TITLE[kind];
  const description =
    state?.mode === 'detail'
      ? `Detalle de ${state.row.item.name}`
      : 'Monto, categoría, billetera y quincenas en que se crea.';

  return (
    <ResponsiveOverlay
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
      title={title}
      description={description}
      dismissLabel={state?.mode === 'detail' ? 'Cerrar' : 'Cancelar'}
      busy={busy}
    >
      {state?.mode === 'detail' ? (
        <ScheduledDetailBody
          row={state.row}
          onActiveChange={onActiveChange}
          savingActive={savingActive}
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
        />
      ) : state?.mode === 'form' ? (
        <ScheduledFormBody
          // A new key per item resets the form when another one opens.
          key={`${kind}-${state.row?.item.id ?? 'new'}`}
          kind={kind}
          row={state.row}
          options={options}
          busy={busy}
          onSubmittingChange={setSubmitting}
          onSaved={onSaved}
        />
      ) : null}
    </ResponsiveOverlay>
  );
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

type FormOptions = {
  categories: CategoryOption[];
  wallets: WalletListItem[];
  loading: boolean;
  failed: boolean;
};

const useFormOptions = (kind: ScheduledKind, context: FinanceContextType): FormOptions => {
  const [options, setOptions] = useState<FormOptions>({
    categories: [],
    wallets: [],
    loading: true,
    failed: false,
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      clientFetchFromApi<CategoryOption[]>(
        kind === 'income' ? '/api/categories?kind=income' : '/api/categories',
        undefined,
        context,
      ),
      clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
    ])
      .then(([categories, wallets]) => {
        if (alive) setOptions({ categories, wallets, loading: false, failed: false });
      })
      .catch(() => {
        if (alive) setOptions({ categories: [], wallets: [], loading: false, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [kind, context]);

  return options;
};

/** Wallets the item can use: active, plus the stored one even if inactive. */
const walletChoices = (
  kind: ScheduledKind,
  wallets: WalletListItem[],
  storedId: number | null,
): WalletListItem[] =>
  wallets.filter((wallet) => {
    if (wallet.id === storedId) return true;
    if (!wallet.active) return false;
    return kind === 'income' ? isIncomeWalletType(wallet.type) : !isGoalWalletType(wallet.type);
  });

// ---------------------------------------------------------------------------
// Form body
// ---------------------------------------------------------------------------

type FormBodyProps = {
  kind: ScheduledKind;
  row: ScheduledRowModel | null;
  options: FormOptions;
  busy: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onSaved: (id: number | null, editing: boolean) => void;
};

const savedId = (response: unknown): number | null => {
  const id = (response as { id?: unknown } | null)?.id;
  return typeof id === 'number' ? id : null;
};

const ScheduledFormBody = ({
  kind,
  row,
  options,
  busy,
  onSubmittingChange,
  onSaved,
}: FormBodyProps) => {
  const { context } = useFinanceContext();
  const editing = row !== null;
  const [error, setError] = useState<string | null>(null);

  const expenseForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: expenseFormDefaults(kind === 'expense' ? row : null),
  });
  const incomeForm = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: incomeFormDefaults(kind === 'income' ? row : null),
  });

  const adjustedHint = useMemo(
    () => (kind === 'expense' && row ? expenseScheduleFor(row).adjustedHint : null),
    [kind, row],
  );

  const save = async (send: () => Promise<unknown>) => {
    setError(null);
    onSubmittingChange(true);
    try {
      const response = await send();
      onSaved(editing ? row.item.id : savedId(response), editing);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : `No se pudo guardar el ${kind === 'expense' ? 'gasto' : 'ingreso'} programado.`,
      );
    } finally {
      onSubmittingChange(false);
    }
  };

  const onExpenseSubmit = expenseForm.handleSubmit((values) =>
    save(() =>
      editing
        ? updateExpenseTemplate(row.item.id, expensePayload(values), context)
        : createExpenseTemplate(expensePayload(values), context),
    ),
  );
  const onIncomeSubmit = incomeForm.handleSubmit((values) =>
    save(() =>
      editing
        ? updateIncomeTemplate(row.item.id, incomePayload(values, row), context)
        : createIncomeTemplate(incomePayload(values, row), context),
    ),
  );

  const disabled = busy || options.loading;
  const wallets = walletChoices(kind, options.wallets, row?.walletId ?? null);
  const primary = (
    <Button type="submit" disabled={disabled} className={cn(OVERLAY_PRIMARY_BUTTON_CLASS, 'mt-1')}>
      {busy ? 'Guardando…' : submitLabel(kind, editing)}
    </Button>
  );
  const banner = error ? (
    <OverlayErrorBanner>{error}</OverlayErrorBanner>
  ) : options.failed ? (
    <OverlayErrorBanner>
      No pudimos cargar las categorías y billeteras. Cierra e inténtalo de nuevo.
    </OverlayErrorBanner>
  ) : null;

  if (kind === 'expense') {
    return (
      <Form {...expenseForm}>
        <form
          onSubmit={onExpenseSubmit}
          className="flex flex-col gap-3"
          data-testid="scheduled-form"
          noValidate
        >
          {banner}
          <AmountCard form={expenseForm} label="Monto" />
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <NameRow form={expenseForm} disabled={disabled} placeholder="Ej. Internet, renta" />
            <CategoryRow form={expenseForm} categories={options.categories} disabled={disabled} />
            <WalletRow
            form={expenseForm}
            label="Paga con"
            wallets={wallets}
            disabled={disabled}
            loading={options.loading}
          />
          </div>
          <CutoffHint form={expenseForm} wallets={wallets} />

          <OverlaySectionLabel>Cuándo se crea</OverlaySectionLabel>
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <DayRow form={expenseForm} period="FIRST" disabled={disabled} />
            <DayRow form={expenseForm} period="SECOND" disabled={disabled} />
          </div>
          {adjustedHint ? (
            <OverlayHint role="status" className="text-status-pending">
              {adjustedHint}
            </OverlayHint>
          ) : null}
          <OverlayHint>{SCHEDULE_HINT}</OverlayHint>

          <FormField
            control={expenseForm.control}
            name="isSubscription"
            render={({ field }) => (
              <ToggleField
                className="px-3"
                label="Suscripción"
                helper="Servicios como streaming o música"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <FormField
            control={expenseForm.control}
            name="active"
            render={({ field }) => (
              <ToggleField
                className="px-3"
                label="Activo"
                helper={ACTIVE_HELPER}
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          {primary}
        </form>
      </Form>
    );
  }

  const fortnightError = incomeForm.formState.errors.first?.message;
  return (
    <Form {...incomeForm}>
      <form
        onSubmit={onIncomeSubmit}
        className="flex flex-col gap-3"
        data-testid="scheduled-form"
        noValidate
      >
        {banner}
        <AmountCard form={incomeForm} label="Monto por quincena" />
        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <NameRow form={incomeForm} disabled={disabled} placeholder="Ej. Sueldo, renta" />
          <CategoryRow form={incomeForm} categories={options.categories} disabled={disabled} />
          <WalletRow
            form={incomeForm}
            label="Billetera"
            wallets={wallets}
            disabled={disabled}
            loading={options.loading}
          />
          <FormField
            control={incomeForm.control}
            name="source"
            render={({ field }) => (
              <FormGroupedRow label="Origen">
                <FormControl>
                  <Input
                    placeholder="Ej. empresa (opcional)"
                    autoComplete="off"
                    disabled={disabled}
                    className={OVERLAY_ROW_INPUT_CLASS}
                    {...field}
                  />
                </FormControl>
              </FormGroupedRow>
            )}
          />
        </div>

        <div className={cn(OVERLAY_GROUPED_CARD_CLASS, 'px-3 py-1')}>
          <FormField
            control={incomeForm.control}
            name="first"
            render={({ field }) => (
              <ToggleField
                className="py-2.5"
                label="1ª quincena"
                helper="Del último día del mes anterior al 14"
                checked={field.value}
                onCheckedChange={(next) => {
                  field.onChange(next);
                  if (fortnightError) void incomeForm.trigger('first');
                }}
                disabled={disabled}
              />
            )}
          />
          <FormField
            control={incomeForm.control}
            name="second"
            render={({ field }) => (
              <ToggleField
                className="py-2.5"
                label="2ª quincena"
                helper="Del 15 al penúltimo día"
                checked={field.value}
                onCheckedChange={(next) => {
                  field.onChange(next);
                  if (fortnightError) void incomeForm.trigger('first');
                }}
                disabled={disabled}
              />
            )}
          />
        </div>
        {fortnightError ? <OverlayErrorBanner>{fortnightError}</OverlayErrorBanner> : null}

        <FormField
          control={incomeForm.control}
          name="active"
          render={({ field }) => (
            <ToggleField
              className="px-3"
              label="Activo"
              helper={ACTIVE_HELPER}
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
        {primary}
      </form>
    </Form>
  );
};

// ---------------------------------------------------------------------------
// Rows (shared by both kinds; the common fields have the same names)
// ---------------------------------------------------------------------------

type CommonValues = Pick<ExpenseFormValues, 'name' | 'categoryId' | 'amount' | 'walletId'>;
// Both forms share these fields; the rows only touch them.
type CommonForm = UseFormReturn<CommonValues>;
const asCommon = (form: UseFormReturn<ExpenseFormValues> | UseFormReturn<IncomeFormValues>) =>
  form as unknown as CommonForm;

type RowProps = {
  form: UseFormReturn<ExpenseFormValues> | UseFormReturn<IncomeFormValues>;
  disabled: boolean;
};

const AmountCard = ({ form, label }: { form: RowProps['form']; label: string }) => (
  <div className="flex flex-col gap-1.5">
    <div className={OVERLAY_GROUPED_CARD_CLASS}>
      <FormField
        control={asCommon(form).control}
        name="amount"
        render={({ field }) => (
          <FormAmountRow
            label={label}
            value={field.value ?? 0}
            onChange={(next) => field.onChange(next > 0 ? next : null)}
          />
        )}
      />
    </div>
    <OverlayHint>{AMOUNT_HINT}</OverlayHint>
  </div>
);

const NameRow = ({ form, disabled, placeholder }: RowProps & { placeholder: string }) => (
  <FormField
    control={asCommon(form).control}
    name="name"
    render={({ field }) => (
      <FormGroupedRow label="Nombre">
        <div className="flex items-center gap-1">
          <FormControl>
            <Input
              placeholder={placeholder}
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="done"
              disabled={disabled}
              className={OVERLAY_ROW_INPUT_CLASS}
              {...field}
            />
          </FormControl>
          {field.value && !disabled ? (
            <FieldClearButton label="Borrar nombre" onClear={() => field.onChange('')} />
          ) : null}
        </div>
      </FormGroupedRow>
    )}
  />
);

const CategoryRow = ({
  form,
  categories,
  disabled,
}: RowProps & { categories: CategoryOption[] }) => {
  const onSelectOpenChange = useOverlaySelectOpenChange();
  return (
    <FormField
      control={asCommon(form).control}
      name="categoryId"
      render={({ field }) => (
        <FormGroupedRow label="Categoría">
          <CategoryGroupedSelect
            categories={categories}
            value={field.value > 0 ? field.value : undefined}
            onValueChange={field.onChange}
            onOpenChange={onSelectOpenChange}
            includeCategoryId={field.value > 0 ? field.value : null}
            disabled={disabled}
            placeholder={disabled && categories.length === 0 ? 'Cargando…' : 'Selecciona'}
            ariaLabel="Categoría"
            triggerClassName={OVERLAY_ROW_TRIGGER_CLASS}
          />
        </FormGroupedRow>
      )}
    />
  );
};

const WalletRow = ({
  form,
  label,
  wallets,
  disabled,
  loading,
}: RowProps & { label: string; wallets: WalletListItem[]; loading: boolean }) => {
  const onSelectOpenChange = useOverlaySelectOpenChange();
  return (
    <FormField
      control={asCommon(form).control}
      name="walletId"
      render={({ field }) => {
        const selected = wallets.find((wallet) => wallet.id === field.value);
        return (
          <FormGroupedRow label={label}>
            <Select
              value={field.value != null ? String(field.value) : NO_WALLET}
              onOpenChange={onSelectOpenChange}
              onValueChange={(value) =>
                field.onChange(value === NO_WALLET ? null : Number(value))
              }
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger className={OVERLAY_ROW_TRIGGER_CLASS} aria-label={label}>
                  <SelectValue placeholder="Sin billetera">
                    {selected ? (
                      <WalletIdentity
                        name={selected.name}
                        providerIconKey={selected.provider_icon_key}
                        iconClassName="h-6 w-6 rounded-md"
                      />
                    ) : loading ? (
                      'Cargando…'
                    ) : (
                      'Sin billetera'
                    )}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={NO_WALLET}>Sin billetera</SelectItem>
                {wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={String(wallet.id)}>
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
  );
};

const CutoffHint = ({
  form,
  wallets,
}: {
  form: UseFormReturn<ExpenseFormValues>;
  wallets: WalletListItem[];
}) => {
  const walletId = form.watch('walletId');
  const hint = cardCutoffHint(wallets.find((wallet) => wallet.id === walletId));
  return hint ? <OverlayHint>{hint}</OverlayHint> : null;
};

const PERIOD_FIELD = { FIRST: 'first', SECOND: 'second' } as const;
const PERIOD_LABEL: Record<ScheduledPeriod, string> = {
  FIRST: '1ª quincena',
  SECOND: '2ª quincena',
};

const DayRow = ({
  form,
  period,
  disabled,
}: {
  form: UseFormReturn<ExpenseFormValues>;
  period: ScheduledPeriod;
  disabled: boolean;
}) => {
  const onSelectOpenChange = useOverlaySelectOpenChange();
  const choices = useMemo(() => daySelectOptions(period), [period]);
  return (
    <FormField
      control={form.control}
      name={PERIOD_FIELD[period]}
      render={({ field }) => (
        <FormGroupedRow label={PERIOD_LABEL[period]} labelWidth="wide">
          <Select
            value={field.value}
            onOpenChange={onSelectOpenChange}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger
                className={OVERLAY_ROW_TRIGGER_CLASS}
                aria-label={`Día en la ${PERIOD_LABEL[period]}`}
              >
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="max-h-72">
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormGroupedRow>
      )}
    />
  );
};
