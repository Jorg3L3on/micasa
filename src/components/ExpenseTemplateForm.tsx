'use client'

import { useEffect, useMemo } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCurrency } from '@/lib/utils'

const expenseTemplateSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  categoryId: z.number().int().positive('Concepto es requerido'),
  defaultAmount: z.number().positive().optional().nullable(),
  paymentMethodId: z.number().int().positive().optional().nullable(),
  active: z.boolean(),
  expenseIds: z.array(z.number().int().positive()),
})

export type ExpenseTemplateFormValues = z.infer<typeof expenseTemplateSchema>

type Category = {
  id: number
  name: string
}

type PaymentMethod = {
  id: number
  name: string
}

type Expense = {
  id: number
  name: string
  defaultAmount: number | null
}

type ExpenseTemplateFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ExpenseTemplateFormValues) => Promise<void>
  defaultValues?: ExpenseTemplateFormValues
  mode: 'create' | 'edit'
  error?: string | null
  categories: Category[]
  paymentMethods: PaymentMethod[]
  expenses: Expense[]
}

export default function ExpenseTemplateForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  mode,
  error,
  categories,
  paymentMethods,
  expenses,
}: ExpenseTemplateFormProps) {
  const form = useForm<ExpenseTemplateFormValues>({
    resolver: zodResolver(expenseTemplateSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      categoryId: defaultValues?.categoryId || 0,
      defaultAmount: defaultValues?.defaultAmount ?? null,
      paymentMethodId: defaultValues?.paymentMethodId ?? null,
      active: defaultValues?.active ?? true,
      expenseIds: defaultValues?.expenseIds || [],
    },
  })

  const selectedExpenseIds = form.watch('expenseIds')

  const totalEstimatedAmount = useMemo(() => {
    const selectedExpenses = expenses.filter((exp) => selectedExpenseIds.includes(exp.id))
    return selectedExpenses.reduce((sum, exp) => {
      return sum + (exp.defaultAmount || 0)
    }, 0)
  }, [selectedExpenseIds, expenses])

  useEffect(() => {
    if (open) {
      form.reset({
        name: defaultValues?.name || '',
        categoryId: defaultValues?.categoryId || 0,
        defaultAmount: defaultValues?.defaultAmount ?? null,
        paymentMethodId: defaultValues?.paymentMethodId ?? null,
        active: defaultValues?.active ?? true,
        expenseIds: defaultValues?.expenseIds || [],
      })
    }
  }, [open, defaultValues, form])

  const handleSubmit = async (data: ExpenseTemplateFormValues) => {
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error al enviar el formulario de plantilla de gasto:', error)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset()
    }
    onOpenChange(newOpen)
  }

  const toggleExpense = (expenseId: number) => {
    const currentIds = form.getValues('expenseIds')
    const newIds = currentIds.includes(expenseId)
      ? currentIds.filter((id) => id !== expenseId)
      : [...currentIds, expenseId]
    form.setValue('expenseIds', newIds)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Agregar plantilla de gasto' : 'Editar plantilla de gasto'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Crea una nueva plantilla de gasto con múltiples gastos.'
              : 'Actualiza la información de la plantilla de gasto.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la plantilla" {...field} />
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                      <FormLabel>Método de pago (opcional)</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.toString() || ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
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
            <FormField
              control={form.control}
              name="expenseIds"
              render={() => (
                <FormItem>
                  <FormLabel>Gastos</FormLabel>
                  <FormControl>
                    <ScrollArea className="h-48 rounded-md border p-4">
                      <div className="space-y-2">
                        {expenses.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay gastos disponibles</p>
                        ) : (
                          expenses.map((expense) => (
                            <div
                              key={expense.id}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded"
                              onClick={() => toggleExpense(expense.id)}
                            >
                              <Checkbox
                                checked={selectedExpenseIds.includes(expense.id)}
                                onChange={(e) => {
                                  e.preventDefault()
                                  toggleExpense(expense.id)
                                }}
                              />
                              <div className="flex-1 flex justify-between items-center">
                                <span className="text-sm">{expense.name}</span>
                                {expense.defaultAmount && (
                                  <span className="text-sm text-muted-foreground">
                                    {formatCurrency(expense.defaultAmount)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-md bg-muted p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total estimado:</span>
                <span className="text-lg font-bold">
                  {formatCurrency(totalEstimatedAmount)}
                </span>
              </div>
            </div>
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
