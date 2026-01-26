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
  expenseAmountSchema,
  ExpenseAmountFormValues,
} from '@/schemas/expense.schema'

type EditExpenseAmountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ExpenseAmountFormValues) => Promise<void>
  defaultAmount: number
  expenseDescription: string
  fortnightLabel: string
  error?: string | null
}

export default function EditExpenseAmountDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultAmount,
  expenseDescription,
  fortnightLabel,
  error,
}: EditExpenseAmountDialogProps) {
  const form = useForm<ExpenseAmountFormValues>({
    resolver: zodResolver(expenseAmountSchema),
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

  const handleSubmit = async (data: ExpenseAmountFormValues) => {
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
          <DialogTitle>Modificar monto del gasto</DialogTitle>
          <DialogDescription>
            Modificar el monto de "{expenseDescription}" para la quincena {fortnightLabel}
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
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
