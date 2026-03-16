'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { formatCurrency } from '@/lib/utils'
import {
  overrideAmountFormSchema,
  OverrideAmountFormValues,
} from '@/schemas/fortnight.schema'

type EditFortnightAmountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: OverrideAmountFormValues) => Promise<void>
  defaultAmount: number
  fortnightLabel: string
  error?: string | null
}

export default function EditFortnightAmountDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultAmount,
  fortnightLabel,
  error,
}: EditFortnightAmountDialogProps) {
  const form = useForm<OverrideAmountFormValues>({
    resolver: zodResolver(overrideAmountFormSchema),
    defaultValues: {
      amount: defaultAmount,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        amount: defaultAmount,
      })
    }
  }, [open, defaultAmount, form])

  const handleSubmit = async (data: OverrideAmountFormValues) => {
    try {
      await onSubmit(data)
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
          <DialogTitle>Modificar ingresos — {fortnightLabel}</DialogTitle>
          <DialogDescription>
            Este monto solo aplica a esta quincena.
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto (MXN)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={
                        typeof field.value === 'number' && !Number.isNaN(field.value)
                          ? field.value
                          : ''
                      }
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === '') {
                          field.onChange(NaN);
                          return;
                        }
                        const parsed = Number.parseFloat(next);
                        field.onChange(Number.isFinite(parsed) ? parsed : field.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-muted-foreground">
                    Monto actual: {formatCurrency(defaultAmount)}
                  </p>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
