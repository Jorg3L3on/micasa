'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { ToggleField } from '@/components/ui/toggle';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { OVERLAY_PRIMARY_BUTTON_CLASS } from '@/components/overlay/overlay-form';
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
  onSave: (values: Step1Values) => Promise<void>;
  error?: string | null;
  disabled?: boolean;
};

const FIELD_HEIGHT_CLASS = 'h-11 md:h-10';

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
  onSave,
  error,
  disabled = false,
}: Props) {
  const form = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: templateFormValues(budget),
  });

  const watchedFrequency = useWatch({ control: form.control, name: 'frequency' });
  const isBusy = form.formState.isSubmitting || disabled;

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
    await onSave(step1Schema.parse(values));
    onOpenChange(false);
  });

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Editar plantilla"
      description="Actualiza el nombre, monto y frecuencia de esta plantilla."
      busy={isBusy}
    >
      {({ handleSelectOpenChange }) => (
        <div className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden data-icon="inline-start" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Supermercado"
                        maxLength={25}
                        className={FIELD_HEIGHT_CLASS}
                        autoCapitalize="sentences"
                        {...field}
                      />
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
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="0"
                        className={`${FIELD_HEIGHT_CLASS} font-sans tabular-nums`}
                      />
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
                    <Select
                      onValueChange={field.onChange}
                      onOpenChange={handleSelectOpenChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger
                          className={`${FIELD_HEIGHT_CLASS} w-full`}
                          aria-label="Frecuencia del presupuesto"
                        >
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

              {watchedFrequency !== 'CUSTOM' ? (
                <FormField
                  control={form.control}
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha inicio</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className={FIELD_HEIGHT_CLASS}
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
                            className={FIELD_HEIGHT_CLASS}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <Button type="submit" className={OVERLAY_PRIMARY_BUTTON_CLASS} disabled={isBusy}>
                {isBusy ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none"
                      data-icon="inline-start"
                    />
                    Guardando…
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </form>
          </Form>
        </div>
      )}
    </ResponsiveOverlay>
  );
}
