'use client'

import { useEffect, useMemo } from 'react'
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
import { CurrencyInput } from '@/components/ui/currency-input'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  createOverrideAmountFormSchema,
  OverrideAmountFormValues,
} from '@/schemas/fortnight.schema'
import { CategoryGroupedSelect } from '@/components/categories/CategoryGroupedSelect'
import type { CategoryOption } from '@/types/catalog'

type EditFortnightAmountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: OverrideAmountFormValues) => Promise<void>
  defaultAmount: number
  fortnightLabel: string
  error?: string | null
  requireCategory?: boolean
  categories?: CategoryOption[]
  defaultCategoryId?: number | null
}

export default function EditFortnightAmountDialog({
  open,
  onOpenChange,
  onSave,
  defaultAmount,
  fortnightLabel,
  error,
  requireCategory = false,
  categories = [],
  defaultCategoryId = null,
}: EditFortnightAmountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modificar ingresos — {fortnightLabel}</DialogTitle>
          <DialogDescription>
            Monto actual: {formatCurrency(defaultAmount)}. Este monto solo aplica
            a esta quincena.
          </DialogDescription>
        </DialogHeader>
        <EditFortnightAmountForm
          key={requireCategory ? 'with-category' : 'amount-only'}
          open={open}
          onOpenChange={onOpenChange}
          onSave={onSave}
          defaultAmount={defaultAmount}
          error={error}
          requireCategory={requireCategory}
          categories={categories}
          defaultCategoryId={defaultCategoryId}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditFortnightAmountForm({
  open,
  onOpenChange,
  onSave,
  defaultAmount,
  error,
  requireCategory,
  categories,
  defaultCategoryId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: OverrideAmountFormValues) => Promise<void>
  defaultAmount: number
  error?: string | null
  requireCategory: boolean
  categories: CategoryOption[]
  defaultCategoryId: number | null
}) {
  const schema = useMemo(
    () => createOverrideAmountFormSchema(requireCategory),
    [requireCategory],
  )

  const form = useForm<OverrideAmountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: defaultAmount,
      categoryId: defaultCategoryId ?? undefined,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        amount: defaultAmount,
        categoryId: defaultCategoryId ?? undefined,
      })
    }
  }, [open, defaultAmount, defaultCategoryId, form])

  const handleSubmit = async (data: OverrideAmountFormValues) => {
    try {
      await onSave(data)
    } catch {
      // Parent shows toast; close either way after the attempt.
    } finally {
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
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
              <FormLabel>Monto</FormLabel>
              <FormControl>
                <CurrencyInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="0.00"
                  aria-label="Monto"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {requireCategory ? (
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <CategoryGroupedSelect
                  categories={categories}
                  value={
                    field.value != null && field.value > 0
                      ? field.value
                      : undefined
                  }
                  onValueChange={field.onChange}
                  includeCategoryId={
                    field.value != null && field.value > 0
                      ? field.value
                      : defaultCategoryId
                  }
                  placeholder="Selecciona una categoría"
                  ariaLabel="Categoría"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
