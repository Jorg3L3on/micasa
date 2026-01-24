'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Select } from '@/components/ui/select';
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
import PageHeader from '@/components/PageHeader';
import { clientFetchFromApi, updateExpenseTemplate } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const expenseTemplateSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  categoryId: z.number().int().positive('Concepto es requerido'),
  suggestedAmount: z.number().positive().optional().nullable(),
  paymentMethodId: z.number().int().positive().optional().nullable(),
  active: z.boolean(),
  dueDay: z.number().int().positive(),
  cutoffDay: z.number().int().positive(),
  isRecurring: z.boolean(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  isSubscription: z.boolean(),
});

export type ExpenseTemplateFormValues = z.infer<typeof expenseTemplateSchema>;

type ExpenseTemplate = {
  id: number;
  name: string;
  category: string;
  suggestedAmount: number | null;
  paymentMethod: string | null;
  active: boolean;
  dueDay: number | null;
  cutoffDay: number | null;
  isRecurring: boolean;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
  isSubscription: boolean;
};

type Category = {
  id: number;
  name: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

export default function EditExpenseTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const [template, setTemplate] = useState<ExpenseTemplate | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
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
            clientFetchFromApi<ExpenseTemplate[]>('/api/expense-templates'),
            clientFetchFromApi<Category[]>('/api/categories'),
            clientFetchFromApi<PaymentMethod[]>('/api/payment-methods'),
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
        form.reset({
          name: foundTemplate.name,
          categoryId:
            categoriesData.find((c) => c.name === foundTemplate.category)?.id ||
            0,
          suggestedAmount: foundTemplate.suggestedAmount ?? null,
          paymentMethodId:
            paymentMethodsData.find(
              (pm) => pm.name === foundTemplate.paymentMethod,
            )?.id || null,
          active: foundTemplate.active,
          dueDay: foundTemplate.dueDay ?? 1,
          cutoffDay: foundTemplate.cutoffDay ?? 1,
          isRecurring: foundTemplate.isRecurring ?? false,
          appliesFirstFortnight: foundTemplate.appliesFirstFortnight ?? false,
          appliesSecondFortnight: foundTemplate.appliesSecondFortnight ?? false,
          isSubscription: foundTemplate.isSubscription ?? false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, form]);

  const handleSubmit = async (data: ExpenseTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await updateExpenseTemplate(id, data);
      router.push('/expense-templates');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update expense template';
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
        <div className="flex items-center gap-4">
          <Link href="/expense-templates">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader title="Editar plantilla de gasto" />
        </div>
        <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error || 'Plantilla no encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/expense-templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title="Editar plantilla de gasto" />
      </div>

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
                        <Select
                          value={field.value?.toString() || ''}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value, 10))
                          }
                          onBlur={field.onBlur}
                        >
                          <option value="">Selecciona una categoría</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </Select>
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
                        <Select
                          value={field.value?.toString() || ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            )
                          }
                          onBlur={field.onBlur}
                        >
                          <option value="">Selecciona un método de pago</option>
                          {paymentMethods.map((pm) => (
                            <option key={pm.id} value={pm.id}>
                              {pm.name}
                            </option>
                          ))}
                        </Select>
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
                <Link href="/expense-templates">
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
