'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  pantryProductFormSchema,
  type PantryProductFormValues,
} from '@/schemas/pantry-product.schema';

type PantryProductFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PantryProductFormValues) => Promise<void>;
  defaultValues?: PantryProductFormValues;
  mode: 'create' | 'edit';
  error?: string | null;
};

const emptyDefaults: PantryProductFormValues = {
  name: '',
  description: '',
  barcode: '',
  brand: '',
  unit_label: '',
  default_unit_price: '',
  active: true,
};

export const PantryProductForm = ({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
}: PantryProductFormProps) => {
  const form = useForm<PantryProductFormValues>({
    resolver: zodResolver(pantryProductFormSchema),
    defaultValues: defaultValues ?? emptyDefaults,
  });

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues);
    } else if (open && !defaultValues) {
      form.reset(emptyDefaults);
    }
  }, [open, defaultValues, form]);

  const handleSubmit = async (data: PantryProductFormValues) => {
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch {
      // Parent shows error; keep dialog open
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Agregar producto' : 'Editar producto'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Registra un producto del catálogo de despensa (referencia para precios y unidad).'
              : 'Actualiza los datos del producto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {error ? (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Nombre
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej. Leche entera 1 L"
                      className="h-9"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Descripción (opcional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Notas o presentación"
                      className="h-9"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Marca
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="barcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Código / SKU
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="unit_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Unidad
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="pz, kg, L…" className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="default_unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Precio ref. (MXN)
                    </FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="Opcional"
                        className="h-9 font-mono tabular-nums"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0 rounded-md border border-border/60 px-3 py-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      id="pantry-product-active"
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="pantry-product-active"
                    className="cursor-pointer text-sm font-normal leading-snug"
                  >
                    Producto activo (visible en listas)
                  </FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="rounded-xl"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'create' ? 'Guardando…' : 'Actualizando…'}
                  </>
                ) : mode === 'create' ? (
                  'Crear'
                ) : (
                  'Actualizar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
