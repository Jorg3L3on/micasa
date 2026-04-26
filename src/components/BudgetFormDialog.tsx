'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
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
import { CurrencyInput } from '@/components/ui/currency-input';
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
import { clientFetchFromApi } from '@/lib/api';
import { useFinanceContext } from '@/context/finance-context';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onSubmit: (step1: Step1Values, step2: Step2Values) => Promise<void>;
  error?: string | null;
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
        'flex items-center justify-between rounded-lg border px-4 py-3 text-sm',
        isOver
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-border bg-muted/40',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Total presupuesto</span>
        <span className="font-semibold">{formatCurrency(totalAmount)}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-center">
        <span className="text-xs text-muted-foreground">Asignado</span>
        <span className="font-semibold">{formatCurrency(allocated)}</span>
      </div>
      <div className="flex flex-col gap-0.5 text-right">
        <span className="text-xs text-muted-foreground">Restante</span>
        <span
          className={cn(
            'font-semibold',
            isOver && 'text-destructive',
            !isOver && !isExact && 'text-amber-600 dark:text-amber-400',
            isExact && 'text-green-700 dark:text-green-400',
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
  onSubmit,
  error,
}: Props) {
  const { context } = useFinanceContext();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const form1 = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      allocated_amount: 0,
      frequency: 'BIWEEKLY',
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

  const watchedAllocations = useWatch({ control: form2.control, name: 'allocations' });
  const watchedFrequency = form1.watch('frequency');

  const allocated = (watchedAllocations ?? []).reduce(
    (sum: number, a: { amount: unknown }) => sum + (Number(a.amount) || 0),
    0,
  );
  const isFullyAllocated =
    step1Data !== null && Math.abs(allocated - Number(step1Data.allocated_amount)) < 0.01;

  useEffect(() => {
    if (open && wallets.length === 0) {
      setLoadingOptions(true);
      Promise.all([
        clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
      ])
        .then(([w, c]) => {
          setWallets(w.filter((wallet) => wallet.active));
          setCategories(c);
        })
        .finally(() => setLoadingOptions(false));
    }
  }, [open, context]);

  const handleClose = () => {
    form1.reset();
    form2.reset({ allocations: [{ wallet_id: 0, category_id: 0, amount: 0 }] });
    setStep(1);
    setStep1Data(null);
    onOpenChange(false);
  };

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
    await onSubmit(step1Data, data);
    handleClose();
  });

  const handleAppend = () => {
    append({ wallet_id: 0, category_id: 0, amount: 0 });
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Nuevo presupuesto' : 'Asignar presupuesto'}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Paso 1 de 2 — Define el nombre, monto y frecuencia.'
              : 'Paso 2 de 2 — Distribuye el presupuesto en carteras y categorías.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
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

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <Form {...form1}>
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <FormField
                control={form1.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Supermercado" maxLength={25} {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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

              {watchedFrequency === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form1.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha inicio</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
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
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* STEP 2 */}
        {step === 2 && step1Data && (
          <Form {...form2}>
            <form onSubmit={handleStep2Submit} className="space-y-4">
              <AllocationSummary
                totalAmount={Number(step1Data.allocated_amount)}
                allocations={watchedAllocations ?? []}
              />

              {form2.formState.errors.root && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {form2.formState.errors.root.message}
                </div>
              )}

              <div ref={scrollRef} className="max-h-60 space-y-3 overflow-y-auto pr-1">
                {loadingOptions ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Cargando opciones…
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_1fr_5.5rem_2rem] items-start gap-2 rounded-lg border p-3"
                    >
                      <FormField
                        control={form2.control}
                        name={`allocations.${index}.wallet_id`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Cartera</FormLabel>
                            <Select
                              onValueChange={(v) => f.onChange(Number(v))}
                              value={f.value ? String(f.value) : ''}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 w-full text-xs">
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
                          <FormItem>
                            <FormLabel className="text-xs">Categoría</FormLabel>
                            <Select
                              onValueChange={(v) => f.onChange(Number(v))}
                              value={f.value ? String(f.value) : ''}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 w-full text-xs">
                                  <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
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
                        name={`allocations.${index}.amount`}
                        render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Monto</FormLabel>
                            <FormControl>
                              <CurrencyInput
                                value={f.value}
                                onChange={f.onChange}
                                className="h-8 text-xs"
                                placeholder="0"
                              />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                          </FormItem>
                        )}
                      />

                      <div className="flex items-end pb-1 pt-6">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          aria-label="Eliminar asignación"
                        >
                          <Trash2 className="h-4 w-4" />
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
                className="w-full"
                onClick={handleAppend}
              >
                <Plus className="mr-1 h-4 w-4" />
                Agregar asignación
              </Button>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  type="submit"
                  disabled={!isFullyAllocated || form2.formState.isSubmitting}
                >
                  {form2.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando…
                    </>
                  ) : (
                    'Crear presupuesto'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
