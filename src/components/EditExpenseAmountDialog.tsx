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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
  expenseAmountSchema,
  ExpenseAmountFormValues,
} from '@/schemas/expense.schema'
import type { WalletListItem } from '@/types/catalog'
import { WalletIdentity } from '@/components/wallets/WalletIdentity'

type EditExpenseAmountDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ExpenseAmountFormValues) => Promise<void>
  defaultAmount: number
  defaultWalletId?: number | null
  expenseDescription: string
  expenseCategory?: string
  fortnightLabel: string
  wallets?: WalletListItem[]
  isPaid?: boolean
  error?: string | null
}

const safeAmount = (value: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0

const NULL_WALLET_VALUE = '__none__'

export default function EditExpenseAmountDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultAmount,
  defaultWalletId,
  expenseDescription,
  expenseCategory = '',
  fortnightLabel,
  wallets = [],
  isPaid = false,
  error,
}: EditExpenseAmountDialogProps) {
  const initialAmount = safeAmount(defaultAmount)

  const form = useForm<ExpenseAmountFormValues>({
    resolver: zodResolver(expenseAmountSchema),
    defaultValues: {
      amount: initialAmount,
      wallet_id: defaultWalletId ?? null,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        amount: safeAmount(defaultAmount),
        wallet_id: defaultWalletId ?? null,
      })
    }
  }, [open, defaultAmount, defaultWalletId, form])

  const handleSubmit = async (data: ExpenseAmountFormValues) => {
    try {
      await onSubmit(data)
    } catch {
      // Parent shows toast; close either way after the attempt.
    } finally {
      onOpenChange(false)
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
          <DialogTitle>Modificar gasto</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <p>
                Modificar &quot;{expenseDescription}&quot;
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
            {wallets.length > 0 && (
              <FormField
                control={form.control}
                name="wallet_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de pago</FormLabel>
                    <Select
                      disabled={isPaid}
                      value={field.value != null ? String(field.value) : NULL_WALLET_VALUE}
                      onValueChange={(val) => {
                        field.onChange(val === NULL_WALLET_VALUE ? null : Number(val))
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin cartera (efectivo)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NULL_WALLET_VALUE}>
                          Sin cartera (efectivo)
                        </SelectItem>
                        {wallets.map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            <WalletIdentity
                              name={w.name}
                              providerIconKey={w.provider_icon_key}
                              iconClassName="h-5 w-5 rounded-md"
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isPaid && (
                      <p className="text-xs text-muted-foreground">
                        No se puede cambiar el método de pago de un gasto ya pagado.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
