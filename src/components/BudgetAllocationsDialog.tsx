'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { cn, formatCurrency } from '@/lib/utils';
import { step2Schema, type Step2Values, type Step2Input } from '@/schemas/budget.schema';
import type { BudgetListItem, CategoryOption, WalletListItem } from '@/types/catalog';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { useFinanceContext } from '@/context/finance-context';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetListItem;
  onSubmit: (allocations: Step2Values['allocations']) => Promise<void>;
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

export default function BudgetAllocationsDialog({
  open,
  onOpenChange,
  budget,
  onSubmit,
  error,
}: Props) {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const form = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      allocations: budget.allocations.length
        ? budget.allocations.map((a) => ({
            wallet_id: a.wallet_id,
            category_id: a.category_id,
            amount: a.amount,
          }))
        : [{ wallet_id: 0, category_id: 0, amount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'allocations' });
  const watchedAllocations = useWatch({ control: form.control, name: 'allocations' });

  const allocated = (watchedAllocations ?? []).reduce(
    (sum: number, a: { amount: unknown }) => sum + (Number(a.amount) || 0),
    0,
  );
  const isFullyAllocated = Math.abs(allocated - budget.allocated_amount) < 0.01;

  const loadOptions = useCallback(() => {
    setLoadingOptions(true);
    setOptionsError(null);
    Promise.all([
      clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
      clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
    ])
      .then(([w, c]) => {
        setWallets(w.filter((wallet) => wallet.active));
        setCategories(c);
      })
      .catch((err) => {
        setOptionsError(
          err instanceof Error ? err.message : 'No se pudieron cargar las opciones',
        );
      })
      .finally(() => setLoadingOptions(false));
  }, [context]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Dialog option loading starts when the dialog opens.
      loadOptions();
      form.reset({
        allocations: budget.allocations.length
          ? budget.allocations.map((a) => ({
              wallet_id: a.wallet_id,
              category_id: a.category_id,
              amount: a.amount,
            }))
          : [{ wallet_id: 0, category_id: 0, amount: 0 }],
      });
    }
  }, [open, budget, form, loadOptions]);

  const handleSubmit = form.handleSubmit(async (rawData) => {
    const data: Step2Values = step2Schema.parse(rawData);
    const sum = data.allocations.reduce(
      (s: number, a: { amount: number }) => s + a.amount,
      0,
    );
    if (Math.abs(sum - budget.allocated_amount) > 0.01) {
      form.setError('root', {
        message: 'El monto asignado debe ser igual al presupuesto total',
      });
      return;
    }
    await onSubmit(data.allocations);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar asignaciones: {budget.name}</DialogTitle>
          <DialogDescription>
            Modifica la distribución del presupuesto entre carteras y categorías.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AllocationSummary
              totalAmount={budget.allocated_amount}
              allocations={watchedAllocations ?? []}
            />

            {form.formState.errors.root ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            ) : null}

            <div ref={scrollRef} className="max-h-60 space-y-3 overflow-y-auto pr-1">
              {loadingOptions ? (
                <div className="space-y-3" aria-busy="true" aria-label="Cargando opciones">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} className="h-40 w-full rounded-lg" />
                  ))}
                </div>
              ) : optionsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" aria-hidden />
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
                    className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_2.5rem]"
                  >
                    <FormField
                      control={form.control}
                      name={`allocations.${index}.wallet_id`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2 min-w-0 sm:col-span-1">
                          <FormLabel className="text-xs">Cartera</FormLabel>
                          <Select
                            onValueChange={(v) => f.onChange(Number(v))}
                            value={f.value ? String(f.value) : ''}
                          >
                            <FormControl>
                              <SelectTrigger
                                className="h-11 w-full text-sm sm:h-8 sm:text-xs"
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
                      control={form.control}
                      name={`allocations.${index}.category_id`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2 min-w-0 sm:col-span-1">
                          <FormLabel className="text-xs">Categoría</FormLabel>
                          <Select
                            onValueChange={(v) => f.onChange(Number(v))}
                            value={f.value ? String(f.value) : ''}
                          >
                            <FormControl>
                              <SelectTrigger
                                className="h-11 w-full text-sm sm:h-8 sm:text-xs"
                                aria-label={`Categoría de la asignación ${index + 1}`}
                              >
                                <SelectValue placeholder="Categoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {formatCategoryLabel(c.name, c.icon)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[10px]" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`allocations.${index}.amount`}
                      render={({ field: f }) => (
                        <FormItem className="min-w-0">
                          <FormLabel className="text-xs">Monto</FormLabel>
                          <FormControl>
                            <CurrencyInput
                              value={f.value}
                              onChange={f.onChange}
                              className="h-11 text-sm sm:h-8 sm:text-xs"
                              placeholder="0"
                              aria-label={`Monto de la asignación ${index + 1}`}
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
                        className="size-11 text-destructive hover:text-destructive sm:size-8"
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
              className="h-11 w-full sm:h-8"
              onClick={handleAppend}
              disabled={loadingOptions || Boolean(optionsError)}
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Agregar asignación
            </Button>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-11 sm:h-9"
                disabled={
                  !isFullyAllocated ||
                  form.formState.isSubmitting ||
                  loadingOptions ||
                  Boolean(optionsError)
                }
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                    Guardando…
                  </>
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
