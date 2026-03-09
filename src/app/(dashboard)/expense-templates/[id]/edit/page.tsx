'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useFinanceContext } from '@/context/finance-context';
import {
  clientFetchFromApi,
  getPaymentMethodOptions,
  updateExpenseTemplate,
} from '@/lib/api';
import Link from 'next/link';
import {
  expenseTemplateSchema,
  ExpenseTemplateFormValues,
} from '@/schemas/expense-template.schema';
import type {
  ExpenseTemplateListItem,
  CategoryOption,
  PaymentMethodOption,
} from '@/types/catalog';

export default function EditExpenseTemplatePage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const id = Number(params.id);
  const [template, setTemplate] = useState<ExpenseTemplateListItem | null>(
    null,
  );
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ExpenseTemplateFormValues>({
    resolver: zodResolver(expenseTemplateSchema),
    defaultValues: {
      name: '',
      categoryId: 0,
      suggestedAmount: null,
      paymentMethodId: null,
      active: true,
      dueDay: 1,
      cutoffDay: 1,
      isRecurring: false,
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
      isSubscription: false,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [templatesData, categoriesData, paymentMethodsData] =
          await Promise.all([
            clientFetchFromApi<ExpenseTemplateListItem[]>(
              '/api/expense-templates',
              undefined,
              context,
            ),
            clientFetchFromApi<CategoryOption[]>('/api/categories', undefined, context),
            getPaymentMethodOptions(context),
          ]);

        const foundTemplate = templatesData.find((t) => t.id === id);
        if (!foundTemplate) {
          setError('Plantilla no encontrada');
          return;
        }

        setTemplate(foundTemplate);
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);

        // Set form values
        const paymentMethodId =
          foundTemplate.paymentMethodId != null
            ? Number(foundTemplate.paymentMethodId)
            : null;

        form.reset({
          name: foundTemplate.name,
          categoryId:
            categoriesData.find((c) => c.name === foundTemplate.category)?.id ||
            0,
          suggestedAmount: foundTemplate.suggestedAmount ?? null,
          paymentMethodId,
          active: foundTemplate.active,
          dueDay: foundTemplate.dueDay ?? 1,
          cutoffDay: foundTemplate.cutoffDay ?? 1,
          isRecurring: foundTemplate.isRecurring ?? false,
          appliesFirstFortnight: foundTemplate.appliesFirstFortnight ?? false,
          appliesSecondFortnight: foundTemplate.appliesSecondFortnight ?? false,
          isSubscription: foundTemplate.isSubscription ?? false,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error al cargar los datos',
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, form, context]);

  const handleSubmit = async (data: ExpenseTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await updateExpenseTemplate(id, data, context);
      toast.success('Plantilla de gasto actualizada');
      router.push(`/expense-templates${queryString ? `?${queryString}` : ''}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al actualizar la plantilla de gasto';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error || 'Plantilla no encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Información de la plantilla</CardTitle>
          <CardDescription>
            Actualiza la información de la plantilla de gasto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nombre de la plantilla"
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
                      <FormLabel>Categoría</FormLabel>
                      <FormControl>
                        <select
                          value={field.value?.toString() || ''}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            field.onChange(parseInt(e.target.value, 10))
                          }
                          onBlur={field.onBlur}
                          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Selecciona una categoría</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="suggestedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto por defecto (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00 MXN"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethodId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de pago (opcional)</FormLabel>
                      <FormControl>
                        <select
                          value={field.value != null ? String(field.value) : ''}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            )
                          }
                          onBlur={field.onBlur}
                          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Selecciona un método de pago</option>
                          {paymentMethods.map((pm) => (
                            <option key={pm.id} value={String(pm.id)}>
                              {pm.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cutoffDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de corte</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={field.value || ''}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de vencimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={field.value || ''}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-base font-medium">
                        Activo
                      </FormLabel>
                      <FormDescription>
                        Las plantillas activas se pueden usar para crear gastos
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">
                    Configuración de recurrencia
                  </h3>
                  <FormField
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-medium">
                            Es recurrente
                          </FormLabel>
                          <FormDescription>
                            Marca esta opción si el gasto se repite
                            periódicamente
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">
                    Aplicación por quincena
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="appliesFirstFortnight"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
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
                              Aplica en días 1-15
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="appliesSecondFortnight"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
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
                              Aplica en días 16-31
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">Tipo de gasto</h3>
                  <FormField
                    control={form.control}
                    name="isSubscription"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-medium">
                            Es una suscripción
                          </FormLabel>
                          <FormDescription>
                            Marca esta opción si es un gasto de suscripción (ej:
                            Netflix, Spotify)
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Link href={`/expense-templates${queryString ? `?${queryString}` : ''}`}>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Actualizar'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
