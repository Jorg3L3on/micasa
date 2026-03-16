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
  expenseCategory?: string
  fortnightLabel: string
  error?: string | null
}

const safeAmount = (value: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

export default function EditExpenseAmountDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultAmount,
  expenseDescription,
  expenseCategory = '',
  fortnightLabel,
  error,
}: EditExpenseAmountDialogProps) {
  const initialAmount = safeAmount(defaultAmount)

  const form = useForm<ExpenseAmountFormValues>({
    resolver: zodResolver(expenseAmountSchema),
    defaultValues: {
      amount: initialAmount,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        amount: safeAmount(defaultAmount),
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
          <DialogDescription asChild>
            <div className="space-y-1">
              <p>
                Modificar el monto de &quot;{expenseDescription}&quot;
                {expenseCategory ? (
                  <>
                    {' '}
                    <span className="text-muted-foreground">(Categoría: {expenseCategory})</span>
                  </>
                ) : null}{' '}
                para la quincena {fortnightLabel}.
              </p>
              <p className="text-sm text-muted-foreground">
                Monto actual: {formatCurrency(initialAmount)}
              </p>
            </div>
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
                      value={
                        typeof field.value === 'number' && !Number.isNaN(field.value)
                          ? field.value
                          : ''
                      }
                      onChange={(e) => {
                        const next = e.target.value
                        if (next === '') {
                          field.onChange(NaN)
                          return
                        }
                        const parsed = Number.parseFloat(next)
                        field.onChange(Number.isFinite(parsed) ? parsed : field.value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
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
