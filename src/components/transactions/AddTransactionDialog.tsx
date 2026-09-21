'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import {
  Form,
  FormControl,
  FormField,
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ToggleField } from '@/components/ui/toggle';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import {
  addExpenseSchema,
  addIncomeFormSchema,
  type AddExpenseFormValues,
  type AddIncomeFormValues,
} from '@/schemas/transaction.schema';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { isGoalWalletType, isTransferableWalletType } from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
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

export type TransactionTab = 'expense' | 'income';

type AddTransactionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveExpense: (values: AddExpenseFormValues) => Promise<void>;
  onSaveIncome: (values: AddIncomeFormValues) => Promise<void>;
  defaultDate?: string;
  /** Which tab is active when the dialog opens. */
  defaultTab?: TransactionTab;
  expenseDefaults?: Partial<AddExpenseFormValues>;
  incomeDefaults?: Partial<AddIncomeFormValues>;
  expenseError?: string | null;
  incomeError?: string | null;
};

function emptyExpense(date: string): AddExpenseFormValues {
  return {
    name: '',
    categoryId: 0,
    amount: 0,
    paymentMethodId: 0,
    date,
    isPaid: false,
    isRecurring: false,
    applyToBothFortnights: false,
    expenseTemplateId: null,
  };
}

function emptyIncome(date: string): AddIncomeFormValues {
  return {
    name: '',
    categoryId: 0,
    amount: 0,
    walletId: 0,
    date,
  };
}

export default function AddTransactionDialog({
  open,
  onOpenChange,
  onSaveExpense,
  onSaveIncome,
  defaultDate,
  defaultTab = 'expense',
  expenseDefaults,
  incomeDefaults,
  expenseError,
  incomeError,
}: AddTransactionDialogProps) {
  const { context } = useFinanceContext();
  const [tab, setTab] = useState<TransactionTab>('expense');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryOption[]>(
    [],
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedDate = defaultDate ?? todayCalendarDate();

  const expenseForm = useForm<AddExpenseFormValues>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: emptyExpense(resolvedDate),
  });
  const incomeForm = useForm<AddIncomeFormValues>({
    resolver: zodResolver(addIncomeFormSchema),
    defaultValues: emptyIncome(resolvedDate),
  });

  useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
    expenseForm.reset({
      ...emptyExpense(resolvedDate),
      ...expenseDefaults,
      date: expenseDefaults?.date ?? resolvedDate,
    });
    incomeForm.reset({
      ...emptyIncome(resolvedDate),
      ...incomeDefaults,
      date: incomeDefaults?.date ?? resolvedDate,
    });
    // Reset only when the dialog opens — not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesData, incomeCategoriesData, paymentMethodsData] =
          await Promise.all([
            clientFetchFromApi<CategoryOption[]>(
              '/api/categories?kind=expense',
              undefined,
              context,
            ),
            clientFetchFromApi<CategoryOption[]>(
              '/api/categories?kind=income',
              undefined,
              context,
            ),
            getPaymentMethodOptions(context),
          ]);
        if (cancelled) return;
        setCategories(categoriesData);
        setIncomeCategories(incomeCategoriesData);
        setPaymentMethods(paymentMethodsData);
      } catch (err) {
        console.error('Error fetching transaction form catalogs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [open, context]);

  const expenseWallets = useMemo(
    () => paymentMethods.filter((pm) => !isGoalWalletType(pm.type)),
    [paymentMethods],
  );

  const incomeWallets = useMemo(
    () =>
      expenseWallets.filter((pm) => isTransferableWalletType(pm.type)),
    [expenseWallets],
  );

  const selectedExpenseWalletId = expenseForm.watch('paymentMethodId');
  const selectedExpenseAmount = expenseForm.watch('amount');
  const isPaidWatch = expenseForm.watch('isPaid');
  const isRecurring = expenseForm.watch('isRecurring');

  const selectedExpenseWallet = useMemo(
    () =>
      paymentMethods.find((m) => m.id === Number(selectedExpenseWalletId)),
    [paymentMethods, selectedExpenseWalletId],
  );

  const isCreditCardPaymentMethod =
    selectedExpenseWallet?.type === 'CREDIT_CARD' ||
    selectedExpenseWallet?.type === 'DEPARTMENT_STORE_CARD';

  const isFundingPaymentMethod =
    selectedExpenseWallet?.type === 'CASH' ||
    selectedExpenseWallet?.type === 'DEBIT_CARD' ||
    isGoalWalletType(selectedExpenseWallet?.type);

  const projectedCardDebt = useMemo(() => {
    if (!isCreditCardPaymentMethod) return null;
    const currentDebt = Number(selectedExpenseWallet?.amount ?? 0);
    const add = Number(selectedExpenseAmount || 0);
    const safeDebt = Number.isFinite(currentDebt) ? currentDebt : 0;
    const safeAdd = Number.isFinite(add) ? add : 0;
    return safeDebt + safeAdd;
  }, [isCreditCardPaymentMethod, selectedExpenseAmount, selectedExpenseWallet]);

  const projectedAvailableCredit = useMemo(() => {
    if (
      !isCreditCardPaymentMethod ||
      selectedExpenseWallet?.credit_limit == null ||
      projectedCardDebt == null
    ) {
      return null;
    }
    const limit = Number(selectedExpenseWallet.credit_limit);
    if (!Number.isFinite(limit)) return null;
    return limit - projectedCardDebt;
  }, [isCreditCardPaymentMethod, projectedCardDebt, selectedExpenseWallet]);

  const exceedsCreditLimit =
    isCreditCardPaymentMethod &&
    projectedAvailableCredit != null &&
    projectedAvailableCredit < 0;

  const fundingBalance = Number(selectedExpenseWallet?.amount ?? 0);
  const exceedsFundingBalance =
    isFundingPaymentMethod &&
    isPaidWatch &&
    Number.isFinite(fundingBalance) &&
    Number(selectedExpenseAmount || 0) > fundingBalance + 1e-9;

  useEffect(() => {
    if (!isCreditCardPaymentMethod) return;
    if (!expenseForm.getValues('isPaid')) {
      expenseForm.setValue('isPaid', true);
    }
  }, [expenseForm, isCreditCardPaymentMethod]);

  const submitExpense = expenseForm.handleSubmit(async (values) => {
    try {
      setIsSubmitting(true);
      await onSaveExpense(values);
    } finally {
      setIsSubmitting(false);
    }
  });

  const submitIncome = incomeForm.handleSubmit(async (values) => {
    try {
      setIsSubmitting(true);
      await onSaveIncome(values);
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleSave = () => {
    if (tab === 'expense') void submitExpense();
    else void submitIncome();
  };

  const saveDisabled =
    isSubmitting ||
    loading ||
    (tab === 'expense' && (exceedsCreditLimit || exceedsFundingBalance));

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Agregar transacción"
      description="Elige gasto o ingreso. Solo se guarda la pestaña activa."
      busy={isSubmitting}
    >
      {({ handleSelectOpenChange }) => (
        <div className="flex flex-col gap-4">
      <TransactionTypeSwitch value={tab} onChange={setTab} />
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as TransactionTab)}
        className="gap-4"
      >
        <div className="grid">
        <TabsContent
          value="expense"
          forceMount
          className="col-start-1 row-start-1 mt-0 outline-none data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
        >
          <Form {...expenseForm}>
            <div className="flex flex-col gap-3">
              {expenseError ? (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {expenseError}
                </div>
              ) : null}
              <div className={OVERLAY_GROUPED_CARD_CLASS}>
                <FormField
                  control={expenseForm.control}
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
                          disabled={loading}
                        >
                          <FormControl>
                            <SelectTrigger className={OVERLAY_ROW_TRIGGER_CLASS}>
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
                  control={expenseForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormAmountRow value={field.value} onChange={field.onChange} />
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormGroupedRow label="Categoría">
                      <CategoryGroupedSelect
                        categories={categories}
                        value={field.value ? Number(field.value) : undefined}
                        onValueChange={field.onChange}
                        onOpenChange={handleSelectOpenChange}
                        disabled={loading}
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
                  control={expenseForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormGroupedRow label="Nombre">
                      <div className="flex items-center gap-1">
                        <FormControl>
                          <Input
                            placeholder="Ej. café, súper"
                            autoCapitalize="sentences"
                            autoComplete="off"
                            enterKeyHint="done"
                            spellCheck
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
                  control={expenseForm.control}
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

              <ToggleField
                layout="row"
                className="px-3"
                label={
                  isCreditCardPaymentMethod
                    ? 'Pagado al usar la tarjeta'
                    : 'Pagado'
                }
                checked={Boolean(isPaidWatch)}
                onCheckedChange={(checked) =>
                  expenseForm.setValue('isPaid', checked)
                }
                disabled={isCreditCardPaymentMethod}
                aria-label="Gasto pagado"
              />
              <ToggleField
                layout="row"
                className="px-3"
                label="Es recurrente"
                checked={Boolean(isRecurring)}
                onCheckedChange={(checked) => {
                  expenseForm.setValue('isRecurring', checked);
                  if (!checked) {
                    expenseForm.setValue('applyToBothFortnights', false);
                  }
                }}
                aria-label="Es recurrente"
              />
              {isRecurring ? (
                <ToggleField
                  layout="row"
                  className="px-3"
                  label="Aplicar a ambas quincenas"
                  checked={Boolean(expenseForm.watch('applyToBothFortnights'))}
                  onCheckedChange={(checked) =>
                    expenseForm.setValue('applyToBothFortnights', checked)
                  }
                  aria-label="Aplicar a ambas quincenas"
                />
              ) : null}
            </div>
          </Form>
        </TabsContent>

        <TabsContent
          value="income"
          forceMount
          className="col-start-1 row-start-1 mt-0 outline-none data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible"
        >
          <Form {...incomeForm}>
            <div className="flex flex-col gap-3">
              {incomeError ? (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {incomeError}
                </div>
              ) : null}
              <div className={OVERLAY_GROUPED_CARD_CLASS}>
                <FormField
                  control={incomeForm.control}
                  name="walletId"
                  render={({ field }) => {
                    const selected = incomeWallets.find(
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
                          disabled={loading}
                        >
                          <FormControl>
                            <SelectTrigger className={OVERLAY_ROW_TRIGGER_CLASS}>
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
                            {incomeWallets.map((pm) => (
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
                  control={incomeForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormAmountRow value={field.value} onChange={field.onChange} />
                  )}
                />

                <FormField
                  control={incomeForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormGroupedRow label="Categoría">
                      <CategoryGroupedSelect
                        categories={incomeCategories}
                        value={field.value ? Number(field.value) : undefined}
                        onValueChange={field.onChange}
                        onOpenChange={handleSelectOpenChange}
                        disabled={loading}
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
                  control={incomeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormGroupedRow label="Nombre">
                      <div className="flex items-center gap-1">
                        <FormControl>
                          <Input
                            placeholder="Ej. sueldo, reembolso"
                            autoCapitalize="sentences"
                            autoComplete="off"
                            enterKeyHint="done"
                            spellCheck
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
                  control={incomeForm.control}
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
            </div>
          </Form>
        </TabsContent>
        </div>
      </Tabs>
      <Button
        type="button"
        onClick={handleSave}
        disabled={saveDisabled}
        className={OVERLAY_PRIMARY_BUTTON_CLASS}
      >
        {isSubmitting ? 'Guardando…' : 'Guardar'}
      </Button>
        </div>
      )}
    </ResponsiveOverlay>
  );
}

const TYPE_SWITCH_PAD = 2;
const TYPE_SWITCH_DRAG_PX = 8;
const TYPE_SWITCH_FLICK = 480;

const TYPE_TABS: {
  id: TransactionTab;
  label: string;
  icon: typeof ArrowDownCircle;
}[] = [
  { id: 'expense', label: 'Gasto', icon: ArrowDownCircle },
  { id: 'income', label: 'Ingreso', icon: ArrowUpCircle },
];

function TransactionTypeSwitch({
  value,
  onChange,
}: {
  value: TransactionTab;
  onChange: (next: TransactionTab) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const travelRef = useRef(0);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startXRef = useRef(0);
  const originXRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const velocityRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [visual, setVisual] = useState<TransactionTab>(value);

  const measureTravel = () => {
    const el = trackRef.current;
    if (!el) return 0;
    return Math.max(0, (el.clientWidth - TYPE_SWITCH_PAD * 2) / 2);
  };

  const targetX = (tab: TransactionTab) =>
    tab === 'income' ? travelRef.current : 0;

  const slideTo = (tab: TransactionTab) => {
    setVisual(tab);
    void animate(x, targetX(tab), {
      type: 'tween',
      duration: reduceMotion ? 0 : 0.2,
      ease: [0.25, 0.1, 0.25, 1],
    });
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const apply = () => {
      travelRef.current = measureTravel();
      if (!draggingRef.current) {
        x.set(targetX(valueRef.current));
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
    // Measure only — do not re-run when `value` changes (that fights the slide).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x]);

  const snapTo = (next: TransactionTab) => {
    slideTo(next);
    if (next !== value) onChange(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    lastTRef.current = e.timeStamp;
    velocityRef.current = 0;
    originXRef.current = x.get();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) < TYPE_SWITCH_DRAG_PX) return;
    movedRef.current = true;
    const dt = e.timeStamp - lastTRef.current;
    if (dt > 0) {
      velocityRef.current = ((e.clientX - lastXRef.current) / dt) * 1000;
    }
    lastXRef.current = e.clientX;
    lastTRef.current = e.timeStamp;
    const travel = travelRef.current;
    const next = Math.min(travel, Math.max(0, originXRef.current + dx));
    x.set(next);
    setVisual(next >= travel / 2 ? 'income' : 'expense');
  };

  const finishPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    if (!movedRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      snapTo(e.clientX >= rect.left + rect.width / 2 ? 'income' : 'expense');
      return;
    }

    const travel = travelRef.current;
    const vx = velocityRef.current;
    let next: TransactionTab = x.get() >= travel / 2 ? 'income' : 'expense';
    if (vx > TYPE_SWITCH_FLICK) next = 'income';
    else if (vx < -TYPE_SWITCH_FLICK) next = 'expense';
    snapTo(next);
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label="Tipo de transacción"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          snapTo(e.key === 'ArrowRight' ? 'income' : 'expense');
        }
      }}
      tabIndex={0}
      className={cn(
        'relative grid h-12 w-full touch-manipulation select-none grid-cols-2 rounded-full p-0.5',
        'border border-border/60 bg-background/80 backdrop-blur-xl',
        'shadow-[0_8px_28px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)]',
        'outline-none dark:border-white/10 dark:bg-black/45',
        'dark:shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]',
      )}
      style={{ touchAction: 'none' }}
    >
      <motion.span
        aria-hidden
        style={{ x }}
        className={cn(
          'pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full',
          'bg-muted dark:bg-white/15',
        )}
      />
      {TYPE_TABS.map(({ id, label, icon: Icon }) => {
        const selected = visual === id;
        return (
          <span
            key={id}
            role="tab"
            aria-selected={selected}
            className="relative z-10 flex min-h-11 flex-col items-center justify-center gap-0"
          >
            <Icon
              aria-hidden
              className={cn(
                'h-5 w-5',
                selected
                  ? 'fill-primary/15 text-primary-text'
                  : 'text-muted-foreground',
              )}
            />
            <span
              className={cn(
                'text-xs font-medium leading-none',
                selected ? 'text-primary-text' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
