'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BUDGET_FREQUENCIES,
  BUDGET_FREQUENCY_LABELS,
  step1Schema,
  type Step1Input,
  type Step1Values,
} from '@/schemas/budget.schema';
import type { BudgetListItem } from '@/types/catalog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetListItem;
  onSubmit: (values: Step1Values) => Promise<void>;
  error?: string | null;
};

function toDateInputValue(value: string | null) {
  if (!value) return null;
  return value.slice(0, 10);
}

function templateFormValues(budget: BudgetListItem): Step1Input {
  return {
    name: budget.name,
    allocated_amount: budget.allocated_amount,
    frequency: budget.frequency as Step1Input['frequency'],
    recurrent: budget.recurrent,
    start_date: toDateInputValue(budget.start_date),
    end_date: toDateInputValue(budget.end_date),
  };
}

export default function BudgetTemplateFieldsDialog({
  open,
  onOpenChange,
  budget,
  onSubmit,
  error,
}: Props) {
  const form = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: templateFormValues(budget),
  });

  const watchedFrequency = useWatch({ control: form.control, name: 'frequency' });

  useEffect(() => {
    if (!open) return;
    form.reset(templateFormValues(budget));
  }, [open, budget, form]);

  useEffect(() => {
    if (watchedFrequency === 'CUSTOM') {
      form.setValue('recurrent', false);
    }
  }, [watchedFrequency, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(step1Schema.parse(values));
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar plantilla</DialogTitle>
          <DialogDescription>
            Actualiza el nombre, monto y frecuencia de esta plantilla.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
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
              control={form.control}
              name="allocated_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto total</FormLabel>
                  <FormControl>
                    <CurrencyInput value={field.value} onChange={field.onChange} placeholder="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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
                      {BUDGET_FREQUENCIES.map((frequency) => (
                        <SelectItem key={frequency} value={frequency}>
                          {BUDGET_FREQUENCY_LABELS[frequency]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedFrequency !== 'CUSTOM' && (
              <FormField
                control={form.control}
                name="recurrent"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">
                      Recurrente (genera periodos al crear nuevo mes)
                    </FormLabel>
                  </FormItem>
                )}
              />
            )}

            {watchedFrequency === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
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
