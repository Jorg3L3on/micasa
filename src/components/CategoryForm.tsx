'use client';

import { useEffect, useMemo } from 'react';
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
import { CategoryIconPicker } from '@/components/categories/CategoryIconPicker';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import {
  createCategoryFormSchema,
  CategoryFormValues,
} from '@/schemas/category.schema';

type CategoryFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CategoryFormValues) => Promise<void>;
  defaultValues?: CategoryFormValues;
  mode: 'create' | 'edit';
  error?: string | null;
};

export default function CategoryForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
}: CategoryFormProps) {
  const existingIcon = defaultValues?.icon ?? null;
  const formSchema = useMemo(
    () => createCategoryFormSchema(existingIcon),
    [existingIcon],
  );

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      name: '',
      description: '',
      icon: '',
    },
  });

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues);
    } else if (open && !defaultValues) {
      form.reset({
        name: '',
        description: '',
        icon: '',
      });
    }
  }, [open, defaultValues, form]);

  const watchedName = form.watch('name');
  const watchedIcon = form.watch('icon');

  const handleSubmit = async (data: CategoryFormValues) => {
    try {
      await onSubmit(data);
      form.reset();
      onOpenChange(false);
    } catch (submitError) {
      if (!(submitError instanceof Error)) {
        console.error('Error al enviar el formulario de categoría:', submitError);
      }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Agregar categoría' : 'Editar categoría'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea una nueva categoría para tus transacciones.'
              : 'Actualiza la información de la categoría.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form} key={`${mode}-${existingIcon ?? 'new'}-${open}`}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la categoría" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ícono</FormLabel>
                  <FormControl>
                    <CategoryIconPicker
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchedName?.trim() ? (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Vista previa
                </p>
                <CategoryLabel name={watchedName} icon={watchedIcon || null} />
              </div>
            ) : null}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Descripción de la categoría"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'create' ? 'Creando...' : 'Actualizando...'}
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
}
