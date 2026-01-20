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
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'

const expenseSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  categoryId: z.number().int().positive('Concepto es requerido'),
  defaultAmount: z.number().positive().optional().nullable(),
  paymentMethodId: z.number().int().positive('Método de pago es requerido'),
  active: z.boolean(),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>

type Category = {
  id: number
  name: string
}

type PaymentMethod = {
  id: number
  name: string
}

type ExpenseFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ExpenseFormValues) => Promise<void>
  defaultValues?: ExpenseFormValues
  mode: 'create' | 'edit'
  error?: string | null
  categories: Category[]
  paymentMethods: PaymentMethod[]
}

export default function ExpenseForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
  categories,
  paymentMethods,
}: ExpenseFormProps) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaultValues || {
      name: '',
      categoryId: 0,
      defaultAmount: null,
      paymentMethodId: 0,
      active: true,
    },
  })

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues)
    } else if (open && !defaultValues) {
      form.reset({
        name: '',
        categoryId: 0,
        defaultAmount: null,
        paymentMethodId: 0,
        active: true,
      })
    }
  }, [open, defaultValues, form])

  const handleSubmit = async (data: ExpenseFormValues): Promise<void> => {
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error al enviar el formulario de gasto:', error)
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
          <DialogTitle>{mode === 'create' ? 'Agregar gasto' : 'Editar gasto'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea una nueva definición de gasto para tus transacciones.'
              : 'Actualiza la información del gasto.'}
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
                    <Input placeholder="Nombre del gasto" {...field} />
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
                  <FormLabel>Concepto</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value?.toString() || ''}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      onBlur={field.onBlur}
                    >
                      <option value="">Selecciona un concepto</option>
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
            <FormField
              control={form.control}
              name="defaultAmount"
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
                        field.onChange(e.target.value ? parseFloat(e.target.value) : null)
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
                  <FormLabel>Método de pago</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value?.toString() || ''}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
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
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Activo</FormLabel>
                  </div>
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
