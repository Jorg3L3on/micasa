'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { ToggleField } from '@/components/ui/toggle';
import { cn, formatCurrency } from '@/lib/utils';
import {
  step1Schema,
  step2Schema,
  BUDGET_FREQUENCY_LABELS,
  BUDGET_FREQUENCIES,
  type Step1Values,
  type Step1Input,
  type Step2Values,
  type Step2Input,
} from '@/schemas/budget.schema';
import type { CategoryOption, WalletListItem } from '@/types/catalog';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { useFinanceContext } from '@/context/finance-context';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect';
import { useIsMobile } from '@/hooks/use-mobile';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (step1: Step1Values, step2: Step2Values) => Promise<void>;
  error?: string | null;
  isPending?: boolean;
  disabled?: boolean;
};

function AllocationSummary({
  totalAmount,
  allocations,
}: {
  totalAmount: number;
  allocations: { amount: unknown }[];
}) {
  const allocated = allocations.reduce(
    (sum: number, a: { amount: unknown }) => sum + (Number(a.amount) || 0),
    0,
  );
  const remaining = totalAmount - allocated;
  const isOver = remaining < 0;
  const isExact = Math.abs(remaining) < 0.01;

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-3 rounded-lg border px-4 py-3 text-sm',
        isOver
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border bg-muted/40',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Total presupuesto</span>
        <span className="font-mono font-semibold tabular-nums">
          {formatCurrency(totalAmount)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-center">
        <span className="text-xs text-muted-foreground">Asignado</span>
        <span className="font-mono font-semibold tabular-nums">
          {formatCurrency(allocated)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-right">
        <span className="text-xs text-muted-foreground">Restante</span>
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            isOver && 'text-destructive',
            !isOver && !isExact && 'text-amber-600 dark:text-amber-400',
            isExact && 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {formatCurrency(remaining)}
        </span>
      </div>
    </div>
  );
}

export default function BudgetFormDialog({
  open,
  onOpenChange,
  onCreate,
  error,
  isPending = false,
  disabled = false,
}: Props) {
  const isMobile = useIsMobile();
  const { context } = useFinanceContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nestedSelectOpenRef = useRef(false);
  const blockDismissUntilRef = useRef(0);

  const form1 = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      allocated_amount: 0,
      frequency: 'BIWEEKLY',
      recurrent: true,
      start_date: null,
      end_date: null,
    },
  });

  const form2 = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      allocations: [{ wallet_id: 0, category_id: 0, amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form2.control,
    name: 'allocations',
  });

  const watchedAllocations = useWatch({
    control: form2.control,
    name: 'allocations',
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- React Hook Form watch is required for this form step.
  const watchedFrequency = form1.watch('frequency');

  useEffect(() => {
    if (watchedFrequency === 'CUSTOM') {
      form1.setValue('recurrent', false);
    }
  }, [watchedFrequency, form1]);

  const allocated = (watchedAllocations ?? []).reduce(
    (sum: number, a: { amount: unknown }) => sum + (Number(a.amount) || 0),
    0,
  );
  const hasEmptyAllocation = (watchedAllocations ?? []).some(
    (allocation) =>
      Number(allocation.wallet_id) <= 0 ||
      Number(allocation.category_id) <= 0 ||
      Number(allocation.amount) <= 0,
  );
  const isFullyAllocated =
    step1Data !== null &&
    !hasEmptyAllocation &&
    Math.abs(allocated - Number(step1Data.allocated_amount)) < 0.01;

  const loadOptions = useCallback(() => {
    setLoadingOptions(true);
    setOptionsError(null);
    Promise.all([
      clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
      clientFetchFromApi<CategoryOption[]>(
        '/api/categories',
        undefined,
        context,
      ),
    ])
      .then(([w, c]) => {
        setWallets(w.filter((wallet) => wallet.active));
        setCategories(c);
      })
      .catch((err) => {
        setOptionsError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar las opciones',
        );
      })
      .finally(() => setLoadingOptions(false));
  }, [context]);

  useEffect(() => {
    if (open && wallets.length === 0) {
      loadOptions();
    }
  }, [open, wallets.length, loadOptions]);

  const handleSelectOpenChange = (nextOpen: boolean) => {
    nestedSelectOpenRef.current = nextOpen;
    if (!nextOpen) {
      // Swallow the same touch that dismissed the list (iOS ghost click).
      blockDismissUntilRef.current = Date.now() + 500;
    }
  };

  const shouldBlockDismiss = () =>
    nestedSelectOpenRef.current || Date.now() < blockDismissUntilRef.current;

  const resetForms = () => {
    form1.reset();
    form2.reset({ allocations: [{ wallet_id: 0, category_id: 0, amount: 0 }] });
    setStep(1);
    setStep1Data(null);
    setOptionsError(null);
  };

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && shouldBlockDismiss()) return;
    if (!nextOpen && (form2.formState.isSubmitting || isPending)) return;
    if (!nextOpen) {
      resetForms();
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
  };

  const preventDismissWhileSelectOpen = (event: {
    preventDefault: () => void;
  }) => {
    if (shouldBlockDismiss()) event.preventDefault();
  };

  const handleCancel = () => handleRootOpenChange(false);

  const handleStep1Submit = form1.handleSubmit((data) => {
    setStep1Data(step1Schema.parse(data));
    setStep(2);
  });

  const handleStep2Submit = form2.handleSubmit(async (rawData) => {
    if (!step1Data) return;
    const data = step2Schema.parse(rawData);
    const total = Number(step1Data.allocated_amount);
    const sum = data.allocations.reduce(
      (s: number, a: { amount: number }) => s + a.amount,
      0,
    );
    if (Math.abs(sum - total) > 0.01) {
      form2.setError('root', {
        message: 'El monto asignado debe ser igual al presupuesto total',
      });
      return;
    }
    await onCreate(step1Data, data);
    resetForms();
    onOpenChange(false);
  });

  const handleAppend = () => {
    append({ wallet_id: 0, category_id: 0, amount: 0 });
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const dialogTitle =
    step === 1 ? 'Nuevo presupuesto' : 'Asignar presupuesto';
  const dialogDescription =
    step === 1
      ? 'Paso 1 de 2: define el nombre, monto y frecuencia.'
      : 'Paso 2 de 2: distribuye el presupuesto en carteras y categorías.';

  const fieldHeight = isMobile ? 'h-11' : 'h-10';
  const selectTriggerClass = isMobile
    ? 'h-11 w-full text-sm'
    : 'h-11 w-full text-sm sm:h-8 sm:text-xs';
  const amountTriggerClass = isMobile
    ? 'h-11 text-sm'
    : 'h-11 text-sm sm:h-8 sm:text-xs';

  const stepIndicator = (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      aria-label={`Paso ${step} de 2`}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium',
          step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        1
      </span>
      <div className="h-px flex-1 bg-border" />
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium',
          step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        2
      </span>
    </div>
  );

  const errorAlert = error ? (
    <Alert variant="destructive" role="alert" aria-live="assertive">
      <AlertCircle
        className="h-4 w-4"
        aria-hidden
        data-icon="inline-start"
      />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  const step1Form = (
    <Form {...form1}>
      <form onSubmit={handleStep1Submit} className="space-y-4">
        <FormField
          control={form1.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: Supermercado"
                  maxLength={25}
                  className={fieldHeight}
                  autoCapitalize="sentences"
                  enterKeyHint="next"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form1.control}
          name="allocated_amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto total</FormLabel>
              <FormControl>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0"
                  className={cn(fieldHeight, 'font-mono tabular-nums')}
                  enterKeyHint="next"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form1.control}
          name="frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frecuencia</FormLabel>
              <Select
                onValueChange={field.onChange}
                onOpenChange={handleSelectOpenChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger
                    className={cn(fieldHeight, 'w-full')}
                    aria-label="Frecuencia del presupuesto"
                  >
                    <SelectValue placeholder="Selecciona frecuencia" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BUDGET_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {BUDGET_FREQUENCY_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedFrequency !== 'CUSTOM' ? (
          <FormField
            control={form1.control}
            name="recurrent"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <ToggleField
                  layout="row"
                  label="Recurrente"
                  helper="Genera periodos al crear nuevo mes"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  aria-label="Presupuesto recurrente"
                />
              </FormItem>
            )}
          />
        ) : null}

        {watchedFrequency === 'CUSTOM' ? (
          <div
            className={cn(
              'grid grid-cols-1 gap-3',
              !isMobile && 'sm:grid-cols-2',
            )}
          >
            <FormField
              control={form1.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha inicio</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className={fieldHeight}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form1.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha fin</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className={fieldHeight}
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value || null)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        {isMobile ? (
          <Button type="submit" className="h-11 w-full rounded-xl">
            Siguiente
            <ChevronRight
              className="ml-1 h-4 w-4"
              aria-hidden
              data-icon="inline-end"
            />
          </Button>
        ) : (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="outline"
              className="h-11 bg-white sm:h-9 dark:bg-card"
            >
              Siguiente
              <ChevronRight
                className="ml-1 h-4 w-4"
                aria-hidden
                data-icon="inline-end"
              />
            </Button>
          </DialogFooter>
        )}
      </form>
    </Form>
  );

  const createDisabled =
    !isFullyAllocated ||
    form2.formState.isSubmitting ||
    isPending ||
    disabled ||
    loadingOptions ||
    Boolean(optionsError);

  const createLabel =
    form2.formState.isSubmitting || isPending || disabled ? (
      <>
        <Loader2
          className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
          data-icon="inline-start"
        />
        Creando…
      </>
    ) : (
      'Crear presupuesto'
    );

  const step2Form =
    step === 2 && step1Data ? (
      <Form {...form2}>
        <form onSubmit={handleStep2Submit} className="space-y-4">
          <AllocationSummary
            totalAmount={Number(step1Data.allocated_amount)}
            allocations={watchedAllocations ?? []}
          />

          {hasEmptyAllocation ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Completa cada asignación con cartera, categoría y un monto mayor
              a $0.00.
            </div>
          ) : null}

          {form2.formState.errors.root ? (
            <Alert variant="destructive">
              <AlertCircle
                className="h-4 w-4"
                aria-hidden
                data-icon="inline-start"
              />
              <AlertDescription>
                {form2.formState.errors.root.message}
              </AlertDescription>
            </Alert>
          ) : null}

          <div
            ref={scrollRef}
            className={cn(
              'space-y-3 overflow-y-auto pr-1',
              isMobile ? 'max-h-[min(50vh,22rem)]' : 'max-h-60',
            )}
          >
            {loadingOptions ? (
              <div
                className="space-y-3"
                aria-busy="true"
                aria-label="Cargando opciones"
              >
                {Array.from({ length: 2 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-40 w-full rounded-lg"
                  />
                ))}
              </div>
            ) : optionsError ? (
              <Alert variant="destructive">
                <AlertCircle
                  className="h-4 w-4"
                  aria-hidden
                  data-icon="inline-start"
                />
                <div className="min-w-0 flex-1">
                  <AlertDescription>{optionsError}</AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={loadOptions}
                  >
                    Reintentar
                  </Button>
                </div>
              </Alert>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className={cn(
                    'grid items-start gap-3 rounded-lg border border-border/60 p-3',
                    isMobile
                      ? 'grid-cols-[minmax(0,1fr)_2.75rem]'
                      : 'grid-cols-[minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_2.5rem]',
                  )}
                >
                  <FormField
                    control={form2.control}
                    name={`allocations.${index}.wallet_id`}
                    render={({ field: f }) => (
                      <FormItem
                        className={cn(
                          'min-w-0',
                          isMobile ? 'col-span-2' : 'col-span-2 sm:col-span-1',
                        )}
                      >
                        <FormLabel className="text-xs">Cartera</FormLabel>
                        <Select
                          onValueChange={(v) => f.onChange(Number(v))}
                          onOpenChange={handleSelectOpenChange}
                          value={f.value ? String(f.value) : ''}
                        >
                          <FormControl>
                            <SelectTrigger
                              className={selectTriggerClass}
                              aria-label={`Cartera de la asignación ${index + 1}`}
                            >
                              <SelectValue placeholder="Cartera" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {wallets.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)}>
                                <WalletIdentity
                                  name={w.name}
                                  providerIconKey={w.provider_icon_key}
                                  iconClassName="h-4.5 w-4.5 rounded-md"
                                  nameClassName="text-xs"
                                />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form2.control}
                    name={`allocations.${index}.category_id`}
                    render={({ field: f }) => (
                      <FormItem
                        className={cn(
                          'min-w-0',
                          isMobile ? 'col-span-2' : 'col-span-2 sm:col-span-1',
                        )}
                      >
                        <FormLabel className="text-xs">Categoría</FormLabel>
                        <CategoryGroupedSelect
                          categories={categories}
                          value={f.value ? Number(f.value) : undefined}
                          onValueChange={f.onChange}
                          onOpenChange={handleSelectOpenChange}
                          includeCategoryId={
                            f.value ? Number(f.value) : null
                          }
                          triggerClassName={selectTriggerClass}
                          placeholder="Categoría"
                          ariaLabel={`Categoría de la asignación ${index + 1}`}
                        />
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form2.control}
                    name={`allocations.${index}.amount`}
                    render={({ field: f }) => (
                      <FormItem className="min-w-0">
                        <FormLabel className="text-xs">Monto</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={f.value}
                            onChange={f.onChange}
                            className={amountTriggerClass}
                            placeholder="0"
                            enterKeyHint="done"
                            aria-label={`Monto de la asignación ${index + 1}`}
                            data-icon="inline-start"
                          />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'text-destructive hover:text-destructive',
                        isMobile ? 'size-11' : 'size-11 sm:size-8',
                      )}
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      aria-label="Eliminar asignación"
                    >
                      <Trash2
                        className="h-4 w-4"
                        data-icon="inline-start"
                      />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('w-full', isMobile ? 'h-11' : 'h-11 sm:h-8')}
            onClick={handleAppend}
            disabled={loadingOptions || Boolean(optionsError)}
          >
            <Plus
              className="mr-1 h-4 w-4"
              aria-hidden
              data-icon="inline-start"
            />
            Agregar asignación
          </Button>

          {isMobile ? (
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                disabled={createDisabled}
                className="h-11 w-full rounded-xl"
              >
                {createLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => setStep(1)}
              >
                <ChevronLeft
                  className="mr-1 h-4 w-4"
                  aria-hidden
                  data-icon="inline-start"
                />
                Anterior
              </Button>
            </div>
          ) : (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => setStep(1)}
              >
                <ChevronLeft
                  className="mr-1 h-4 w-4"
                  aria-hidden
                  data-icon="inline-start"
                />
                Anterior
              </Button>
              <Button
                type="submit"
                variant="outline"
                className="h-11 bg-white sm:h-9 dark:bg-card"
                disabled={createDisabled}
              >
                {createLabel}
              </Button>
            </DialogFooter>
          )}
        </form>
      </Form>
    ) : null;

  const formBody = (
    <div className="flex flex-col gap-4">
      {stepIndicator}
      {errorAlert}
      {step === 1 ? step1Form : step2Form}
    </div>
  );

  const sheetHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      <Button
        type="button"
        variant="ghost"
        className="absolute left-0 h-9 px-2 text-primary"
        onClick={handleCancel}
        disabled={form2.formState.isSubmitting || isPending}
      >
        Cancelar
      </Button>
      <SheetTitle className="text-base font-semibold">{dialogTitle}</SheetTitle>
      <SheetDescription className="sr-only">
        {dialogDescription}
      </SheetDescription>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleRootOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
          onPointerDownOutside={preventDismissWhileSelectOpen}
          onFocusOutside={preventDismissWhileSelectOpen}
          onInteractOutside={preventDismissWhileSelectOpen}
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open ? formBody : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleRootOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        onPointerDownOutside={preventDismissWhileSelectOpen}
        onFocusOutside={preventDismissWhileSelectOpen}
        onInteractOutside={preventDismissWhileSelectOpen}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        {open ? formBody : null}
      </DialogContent>
    </Dialog>
  );
}
