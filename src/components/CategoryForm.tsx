'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const categorySchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  type: z.enum(['income', 'expense']),
})

export type CategoryFormValues = z.infer<typeof categorySchema>

type CategoryFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: CategoryFormValues) => Promise<void>
  defaultValues?: CategoryFormValues
  mode: 'create' | 'edit'
  error?: string | null
}

export default function CategoryForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
}: CategoryFormProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultValues || {
      name: '',
      type: 'expense',
    },
  })

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues)
    } else if (open && !defaultValues) {
      form.reset({
        name: '',
        type: 'expense',
      })
    }
  }, [open, defaultValues, form])

  const handleSubmit = async (data: CategoryFormValues) => {
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error al enviar el formulario de categoría:', error)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Agregar categoría' : 'Editar categoría'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea una nueva categoría para tus transacciones.'
              : 'Actualiza la información de la categoría.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    >
                      <option value="expense">Gasto</option>
                      <option value="income">Ingreso</option>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">{mode === 'create' ? 'Crear' : 'Actualizar'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
