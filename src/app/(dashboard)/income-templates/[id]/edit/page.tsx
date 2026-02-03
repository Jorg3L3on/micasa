'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { clientFetchFromApi, updateIncomeTemplate } from '@/lib/api';
import Link from 'next/link';
import {
  incomeTemplateSchema,
  type IncomeTemplateFormValues,
} from '@/schemas/income-template.schema';
import type { IncomeTemplateListItem } from '@/types/catalog';

export default function EditIncomeTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const [template, setTemplate] = useState<IncomeTemplateListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<IncomeTemplateFormValues>({
    resolver: zodResolver(incomeTemplateSchema),
    defaultValues: {
      name: '',
      suggestedAmount: null,
      source: '',
      appliesFirstFortnight: false,
      appliesSecondFortnight: false,
      active: true,
      userId: null,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await clientFetchFromApi<IncomeTemplateListItem[]>(
          '/api/income-templates',
        );
        const found = data.find((t) => t.id === id);
        if (!found) {
          setError('Plantilla no encontrada');
          return;
        }
        setTemplate(found);
        form.reset({
          name: found.name,
          suggestedAmount: found.suggestedAmount ?? null,
          source: found.source ?? '',
          appliesFirstFortnight: found.appliesFirstFortnight,
          appliesSecondFortnight: found.appliesSecondFortnight,
          active: found.active,
          userId: found.userId ?? null,
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
  }, [id, form]);

  const handleSubmit = async (data: IncomeTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await updateIncomeTemplate(id, {
        name: data.name,
        suggestedAmount: data.suggestedAmount ?? null,
        source: data.source && data.source.trim() ? data.source.trim() : null,
        appliesFirstFortnight: data.appliesFirstFortnight,
        appliesSecondFortnight: data.appliesSecondFortnight,
        active: data.active,
      });
      toast.success('Plantilla de ingresos actualizada');
      router.push('/income-templates');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar la plantilla';
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
        <Link href="/income-templates">
          <Button variant="outline">Volver a plantillas</Button>
        </Link>
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
          <CardTitle>Editar plantilla de ingresos</CardTitle>
          <CardDescription>
            Actualiza la información de la plantilla de ingresos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej. Salario, Freelance"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="suggestedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto sugerido (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00 MXN"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            )
                          }
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej. Empresa, Proyecto"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Aplicación por quincena</h3>
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
                        Las plantillas activas se usan al crear un mes
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Link href="/income-templates">
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
