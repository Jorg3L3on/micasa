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
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['CARD', 'CASH']).optional(),
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
      type: 'CARD',
    },
  })

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues)
    } else if (open && !defaultValues) {
      form.reset({
        name: '',
        type: 'CARD',
      })
    }
  }, [open, defaultValues, form])

  const handleSubmit = async (data: PaymentMethodFormValues) => {
    try {
      // Ensure type is always sent (default to CARD if not provided)
      await onSubmit({ ...data, type: data.type || 'CARD' })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the parent component
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
            {mode === 'create' ? 'Add Payment Method' : 'Edit Payment Method'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Create a new payment method for your transactions.'
              : 'Update the payment method information.'}
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Payment method name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{mode === 'create' ? 'Create' : 'Update'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
