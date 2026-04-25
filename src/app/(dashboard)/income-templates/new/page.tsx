'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { clientFetchFromApi, createIncomeTemplate } from '@/lib/api';
import Link from 'next/link';
import {
  incomeTemplateSchema,
  type IncomeTemplateFormValues,
} from '@/schemas/income-template.schema';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type HouseUserItem = {
  id: number;
  name: string;
  email: string;
};

const FIELD_CLASSNAME =
  'h-11 rounded-lg border border-white/15 bg-black/35 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors placeholder:text-muted-foreground hover:border-white/25 hover:bg-black/45 focus-visible:border-white/35 focus-visible:bg-black/45 focus-visible:ring-2 focus-visible:ring-white/15 focus-visible:ring-offset-0';

export default function NewIncomeTemplatePage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [houseMembers, setHouseMembers] = useState<HouseUserItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const isHouseContext = context.type === 'house';

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
    if (!isHouseContext) {
      setHouseMembers([]);
      return;
    }
    setLoadingMembers(true);
    clientFetchFromApi<{ users: HouseUserItem[] }>(
      '/api/house-users',
      undefined,
      context,
    )
      .then((data) => setHouseMembers(data.users))
      .catch(() => setHouseMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [isHouseContext, context]);

  const handleSubmit = async (data: IncomeTemplateFormValues) => {
    try {
      setIsSubmitting(true);
      await createIncomeTemplate(
        {
          name: data.name,
          suggestedAmount: data.suggestedAmount ?? null,
          source: data.source && data.source.trim() ? data.source.trim() : null,
          appliesFirstFortnight: data.appliesFirstFortnight,
          appliesSecondFortnight: data.appliesSecondFortnight,
          active: data.active,
          userId: isHouseContext ? data.userId ?? null : null,
        },
        context,
      );
      toast.success('Plantilla de ingresos creada');
      setTimeout(() => {
        router.push(`/income-templates${queryString ? `?${queryString}` : ''}`);
      }, 500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear la plantilla';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nueva plantilla de ingresos</CardTitle>
          <CardDescription>
            Crea una plantilla de ingresos recurrente. Se usará al crear un mes
            para generar ingresos (Income) en las quincenas indicadas.
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
                          className={FIELD_CLASSNAME}
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
                          className={FIELD_CLASSNAME}
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
                        className={FIELD_CLASSNAME}
                        placeholder="Ej. Empresa, Proyecto"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isHouseContext && (
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Miembro que transfiere a la casa (opcional)
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? String(field.value) : ''}
                          onValueChange={(value) =>
                            field.onChange(
                              value ? Number(value) : null,
                            )
                          }
                          disabled={loadingMembers || houseMembers.length === 0}
                        >
                          <SelectTrigger className={`w-full ${FIELD_CLASSNAME}`}>
                            <SelectValue placeholder="Selecciona un miembro (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {houseMembers.map((member) => (
                              <SelectItem
                                key={member.id}
                                value={String(member.id)}
                              >
                                {member.name}
                                {member.email ? ` (${member.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Si seleccionas un miembro, este ingreso se registrará como
                        transferencia de ese usuario hacia la casa (creando un gasto
                        para el usuario y un ingreso para la casa).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
                <Link
                  href={`/plantillas-de-ingresos${queryString ? `?${queryString}` : ''}`}
                >
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
    </div>
  );
}
