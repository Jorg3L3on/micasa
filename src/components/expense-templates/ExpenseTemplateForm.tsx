'use client';

import Link from 'next/link';
import type { UseFormReturn } from 'react-hook-form';
import { ChevronDown, ReceiptText } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ExpenseTemplateFormValues } from '@/schemas/expense-template.schema';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { formatCategoryLabel } from '@/components/categories/CategoryLabel';
import { BoundedDayFieldInput } from '@/components/expense-templates/bounded-day-input';

type ExpenseTemplateFormProps = {
  form: UseFormReturn<ExpenseTemplateFormValues>;
  title: string;
  description: string;
  submitLabel: string;
  isSubmitting: boolean;
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
  cutoffSectionOpen: boolean;
  onCutoffSectionOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseTemplateFormValues) => Promise<void>;
  cancelHref: string;
};

const FIELD_CLASSNAME =
  'h-11 rounded-lg border border-white/15 bg-black/35 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:text-muted-foreground hover:border-white/25 hover:bg-black/45 focus-visible:border-white/35 focus-visible:bg-black/45 focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:ring-offset-0';

export function ExpenseTemplateForm({
  form,
  title,
  description,
  submitLabel,
  isSubmitting,
  categories,
  paymentMethods,
  cutoffSectionOpen,
  onCutoffSectionOpenChange,
  onSubmit,
  cancelHref,
}: ExpenseTemplateFormProps) {
  const isRecurring = form.watch('isRecurring');
  const appliesFirstFortnight = form.watch('appliesFirstFortnight');
  const appliesSecondFortnight = form.watch('appliesSecondFortnight');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
              <ReceiptText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold leading-none">
                Datos de la plantilla
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                Define la base para crear gastos rapido y consistente.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          className={FIELD_CLASSNAME}
                          placeholder="Ej. Super semanal, Netflix"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select
                        value={field.value > 0 ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={FIELD_CLASSNAME}
                            aria-label="Seleccionar categoria"
                          >
                            <SelectValue placeholder="Selecciona una categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {formatCategoryLabel(category.name, category.icon)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="suggestedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto por defecto (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          className={FIELD_CLASSNAME}
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00 MXN"
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value
                                ? Number.parseFloat(event.target.value)
                                : null,
                            )
                          }
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Si lo dejas vacio, el monto se define al crear el gasto.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethodId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metodo de pago (opcional)</FormLabel>
                      <Select
                        value={field.value != null ? String(field.value) : 'none'}
                        onValueChange={(value) =>
                          field.onChange(value === 'none' ? null : Number(value))
                        }
                      >
                        <FormControl>
                          <SelectTrigger
                            className={FIELD_CLASSNAME}
                            aria-label="Seleccionar metodo de pago"
                          >
                            <SelectValue placeholder="Sin metodo por defecto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin metodo por defecto</SelectItem>
                          {paymentMethods.map((paymentMethod) => (
                            <SelectItem
                              key={paymentMethod.id}
                              value={String(paymentMethod.id)}
                            >
                              <WalletIdentity
                                name={paymentMethod.name}
                                providerIconKey={paymentMethod.provider_icon_key}
                                iconClassName="h-5 w-5 rounded-md"
                              />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <h3 className="text-sm font-semibold">Programacion recurrente</h3>
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border/60 p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue('appliesFirstFortnight', false);
                              form.setValue('appliesSecondFortnight', false);
                              form.setValue('isSubscription', false);
                              form.setValue('dueDayFirst', null);
                              form.setValue('dueDaySecond', null);
                            }
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          Se repite de forma periodica
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Activalo para decidir en que quincenas aparece automaticamente.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {isRecurring && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-3 rounded-lg border border-border/60 p-3">
                      <FormField
                        control={form.control}
                        name="appliesFirstFortnight"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-medium">
                                Primera quincena
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Dias 1 al 15
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      {appliesFirstFortnight && (
                        <FormField
                          control={form.control}
                          name="dueDayFirst"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">
                                Dia de vencimiento (1-15)
                              </FormLabel>
                              <FormControl>
                                <BoundedDayFieldInput
                                  className={FIELD_CLASSNAME}
                                  min={1}
                                  max={15}
                                  aria-label="Dia de vencimiento primera quincena"
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="space-y-3 rounded-lg border border-border/60 p-3">
                      <FormField
                        control={form.control}
                        name="appliesSecondFortnight"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-medium">
                                Segunda quincena
                              </FormLabel>
                              <FormDescription className="text-xs">
                                Dias 16 al 31
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      {appliesSecondFortnight && (
                        <FormField
                          control={form.control}
                          name="dueDaySecond"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">
                                Dia de vencimiento (16-31)
                              </FormLabel>
                              <FormControl>
                                <BoundedDayFieldInput
                                  className={FIELD_CLASSNAME}
                                  min={16}
                                  max={31}
                                  aria-label="Dia de vencimiento segunda quincena"
                                  value={field.value}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Collapsible
                open={cutoffSectionOpen}
                onOpenChange={onCutoffSectionOpenChange}
                className="rounded-lg border border-border/60"
              >
                <CollapsibleTrigger
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                  aria-expanded={cutoffSectionOpen}
                  aria-label="Mostrar u ocultar dia de corte opcional"
                >
                  <span>Dia de corte (opcional)</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                      cutoffSectionOpen && 'rotate-180',
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 px-3 pb-3 pt-0">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Util para suscripciones o cargos fijos. No cambia como se reparte
                    por quincenas.
                  </p>
                  <FormField
                    control={form.control}
                    name="cutoffDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Dia del mes</FormLabel>
                        <FormControl>
                          <BoundedDayFieldInput
                            className={FIELD_CLASSNAME}
                            min={1}
                            max={31}
                            placeholder="Vacio = sin corte"
                            aria-label="Dia de corte del mes"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-3 rounded-xl border border-border/60 p-4">
                <h3 className="text-sm font-semibold">Estado de la plantilla</h3>
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border/60 p-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          Plantilla activa
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Solo las plantillas activas aparecen al generar gastos.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {isRecurring && (
                  <FormField
                    control={form.control}
                    name="isSubscription"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border/60 p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-medium">
                            Es una suscripcion
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Marca esta opcion para servicios tipo Netflix o Spotify.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Link href={cancelHref}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="h-11 w-full sm:w-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : submitLabel}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
