'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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

  useEffect(() => {
    if (open) {
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
  }, [open, context, budget]);

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar asignaciones — {budget.name}</DialogTitle>
          <DialogDescription>
            Modifica la distribución del presupuesto entre carteras y categorías.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AllocationSummary
              totalAmount={budget.allocated_amount}
              allocations={watchedAllocations ?? []}
            />

            {form.formState.errors.root && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {form.formState.errors.root.message}
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
                      control={form.control}
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
                      control={form.control}
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
                      control={form.control}
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!isFullyAllocated || form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
