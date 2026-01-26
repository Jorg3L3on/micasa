'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle } from 'lucide-react';
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
import { clientFetchFromApi, createExpenseTemplate } from '@/lib/api';
import Link from 'next/link';
import {
  expenseTemplateSchema,
  ExpenseTemplateFormValues,
} from '@/schemas/expense-template.schema';

type Category = {
  id: number;
  name: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

export default function NewExpenseTemplatePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ message, type });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
        const [categoriesData, paymentMethodsData] = await Promise.all([
          clientFetchFromApi<Category[]>('/api/categories'),
          clientFetchFromApi<PaymentMethod[]>('/api/payment-methods'),
        ]);
        setCategories(categoriesData);
        setPaymentMethods(paymentMethodsData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error al cargar los datos';
        showToast(message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getErrorMessage = (err: unknown): string => {
    if (!(err instanceof Error)) {
      return 'Error al crear la plantilla de gasto';
    }

    // Check if error has details (validation errors)
    const errorWithDetails = err as any;
    if (
      errorWithDetails.details &&
      Array.isArray(errorWithDetails.details) &&
      errorWithDetails.details.length > 0
    ) {
      // Map field names to Spanish
      const fieldNames: Record<string, string> = {
        name: 'Nombre',
        categoryId: 'Categoría',
        suggestedAmount: 'Monto por defecto',
        paymentMethodId: 'Método de pago',
        dueDay: 'Día de vencimiento',
        cutoffDay: 'Día de corte',
        isRecurring: 'Recurrente',
        appliesFirstFortnight: 'Primera quincena',
        appliesSecondFortnight: 'Segunda quincena',
        isSubscription: 'Suscripción',
      };

      // Format validation errors
      const messages = errorWithDetails.details.map((issue: any) => {
        const fieldName =
          fieldNames[issue.path?.[0]] || issue.path?.[0] || 'Campo';
        let message = issue.message || '';

        // Translate common validation messages
        if (message.includes('Required') || message.includes('required')) {
          message = 'es requerido';
        } else if (message.includes('Expected')) {
          message = 'tiene un formato inválido';
        } else if (message.includes('positive')) {
          message = 'debe ser un número positivo';
        } else if (message.includes('int')) {
          message = 'debe ser un número entero';
        } else if (message.includes('Invalid')) {
          message = 'tiene un valor inválido';
        }

        return `${fieldName} ${message}`;
      });

      return messages.join('. ');
    }

    // Check for specific error messages and translate them
    const errorMessage = err.message;
    if (errorMessage.includes('Validation error')) {
      return 'Por favor, verifica los campos del formulario';
    }
    if (errorMessage.includes('already exists')) {
      return 'Ya existe una plantilla con este nombre';
    }
    if (errorMessage.includes('Failed to create')) {
      return 'Error al crear la plantilla de gasto';
    }

    return errorMessage || 'Error al crear la plantilla de gasto';
  };

  const handleSubmit = async (data: ExpenseTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      await createExpenseTemplate(data);
      showToast('Plantilla de gasto creada exitosamente', 'success');
      // Wait a bit before redirecting to show the success toast
      setTimeout(() => {
        router.push('/expense-templates');
      }, 500);
    } catch (err) {
      const message = getErrorMessage(err);
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la plantilla</CardTitle>
          <CardDescription>
            Crea una nueva plantilla de gasto con múltiples gastos.
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
                          value={field.value?.toString() || ''}
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
                            <option key={pm.id} value={pm.id}>
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
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              field.onChange(1);
                            } else {
                              const num = parseInt(value, 10);
                              if (!isNaN(num) && num >= 1 && num <= 31) {
                                field.onChange(num);
                              }
                            }
                          }}
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
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              field.onChange(1);
                            } else {
                              const num = parseInt(value, 10);
                              if (!isNaN(num) && num >= 1 && num <= 31) {
                                field.onChange(num);
                              }
                            }
                          }}
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
                  {isSubmitting ? 'Guardando...' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Toast feedback */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-900/90 dark:border-emerald-800 dark:text-emerald-50'
                : 'bg-destructive/10 border-destructive/70 text-destructive dark:bg-destructive/20 dark:border-destructive dark:text-destructive'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
