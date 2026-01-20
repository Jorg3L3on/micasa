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
import { Button } from '@/components/ui/button'

const paymentMethodSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  type: z.enum(['CARD', 'CASH']).nullable(),
})

export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>

type PaymentMethodFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: PaymentMethodFormValues) => Promise<void>
  defaultValues?: PaymentMethodFormValues
  mode: 'create' | 'edit'
  error?: string | null
}

export default function PaymentMethodForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
}: PaymentMethodFormProps) {
  const form = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: defaultValues || {
      name: '',
      type: null,
    },
  })

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues)
    } else if (open && !defaultValues) {
      form.reset({
        name: '',
        type: null,
      })
    }
  }, [open, defaultValues, form])

  const handleSubmit = async (data: PaymentMethodFormValues) => {
    try {
      await onSubmit({ ...data, type: data.type ?? null })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error al enviar el formulario de método de pago:', error)
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
          <DialogTitle>
            {mode === 'create' ? 'Agregar método de pago' : 'Editar método de pago'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea un nuevo método de pago para tus transacciones.'
              : 'Actualiza la información del método de pago.'}
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
                    <Input placeholder="Nombre del método de pago" {...field} />
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
