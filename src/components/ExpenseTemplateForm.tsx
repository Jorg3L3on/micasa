'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Checkbox } from './ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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

type Category = {
  id: number;
  name: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

type ExpenseTemplateFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ExpenseTemplateFormValues) => Promise<void>;
  defaultValues?: ExpenseTemplateFormValues;
  mode: 'create' | 'edit';
  error?: string | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
};

export default function ExpenseTemplateForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
  categories,
  paymentMethods,
}: ExpenseTemplateFormProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingData, setPendingData] =
    useState<ExpenseTemplateFormValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExpenseTemplateFormValues>({
    resolver: zodResolver(expenseTemplateSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      categoryId: defaultValues?.categoryId ?? 0,
      suggestedAmount: defaultValues?.suggestedAmount ?? null,
      paymentMethodId: defaultValues?.paymentMethodId ?? null,
      active: defaultValues?.active ?? true,
      dueDay: defaultValues?.dueDay ?? 1,
      cutoffDay: defaultValues?.cutoffDay ?? 1,
      isRecurring: defaultValues?.isRecurring ?? false,
      appliesFirstFortnight: defaultValues?.appliesFirstFortnight ?? false,
      appliesSecondFortnight: defaultValues?.appliesSecondFortnight ?? false,
      isSubscription: defaultValues?.isSubscription ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: defaultValues?.name || '',
        categoryId: defaultValues?.categoryId || 0,
        suggestedAmount: defaultValues?.suggestedAmount ?? null,
        paymentMethodId: defaultValues?.paymentMethodId ?? null,
        active: defaultValues?.active ?? true,
        dueDay: defaultValues?.dueDay ?? 1,
        cutoffDay: defaultValues?.cutoffDay ?? 1,
        isRecurring: defaultValues?.isRecurring ?? false,
        appliesFirstFortnight: defaultValues?.appliesFirstFortnight ?? false,
        appliesSecondFortnight: defaultValues?.appliesSecondFortnight ?? false,
        isSubscription: defaultValues?.isSubscription ?? false,
      });
    }
  }, [open, defaultValues, form]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setConfirmDialogOpen(false);
      setPendingData(null);
    }
    onOpenChange(newOpen);
  };

  const handleFormSubmit = (data: ExpenseTemplateFormValues) => {
    setPendingData(data);
    setConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingData) return;

    try {
      setIsSubmitting(true);
      await onSubmit(pendingData);
      setConfirmDialogOpen(false);
      setPendingData(null);
      handleOpenChange(false);
    } catch (error) {
      // Error is handled by parent component
      setConfirmDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? 'Agregar plantilla de gasto'
              : 'Editar plantilla de gasto'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea una nueva plantilla de gasto con múltiples gastos.'
              : 'Actualiza la información de la plantilla de gasto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
            id="expense-template-form"
          >
            <ScrollArea className="max-h-[60vh] pr-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mx-1.5">
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
              <div className="grid grid-cols-2 gap-4 mx-1.5">
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
              <div className="grid grid-cols-2 gap-4 mx-1.5">
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
              </div>

              <Separator className="my-4" />
              {/* Active Status */}
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

              <Separator className="my-4" />

              {/* Recurring Section */}
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

                {/* Fortnight Application Section */}
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

                {/* Subscription Section */}
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
            </ScrollArea>
          </form>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="expense-template-form"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Guardando...'
                : mode === 'create'
                  ? 'Crear'
                  : 'Actualizar'}
            </Button>
          </DialogFooter>
        </Form>

        {/* Confirmation Dialog */}
        <AlertDialog
          open={confirmDialogOpen}
          onOpenChange={setConfirmDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {mode === 'create'
                  ? '¿Crear plantilla de gasto?'
                  : '¿Actualizar plantilla de gasto?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {mode === 'create'
                  ? '¿Estás seguro de que deseas crear esta plantilla de gasto? Esta acción guardará los datos en la base de datos.'
                  : '¿Estás seguro de que deseas actualizar esta plantilla de gasto? Los cambios se guardarán en la base de datos.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Guardando...'
                  : mode === 'create'
                    ? 'Crear'
                    : 'Actualizar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
