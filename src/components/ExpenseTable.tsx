'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { updateExpensePaidStatus, updateExpenseAmount } from '@/lib/api'
import { Pencil } from 'lucide-react'
import EditExpenseAmountDialog, { ExpenseAmountFormValues } from '@/components/EditExpenseAmountDialog'

type Expense = {
  id: number
  date: string
  description: string
  amount: number | string
  category: string
  paymentMethod: string
  is_paid: boolean
}

type ExpenseTableProps = {
  date?: string
  expenses: Expense[]
  onExpenseUpdate?: (expenseId: number, isPaid: boolean) => void
  fortnightLabel?: string
}

export default function ExpenseTable({ date, expenses, onExpenseUpdate, fortnightLabel = '' }: ExpenseTableProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set())
  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Sync local state with props when expenses change and sort them
  useEffect(() => {
    // Sort expenses: unpaid first (by amount descending), then paid (by amount descending)
    const sorted = [...expenses].sort((a, b) => {
      // First, separate paid and unpaid
      if (a.is_paid !== b.is_paid) {
        // Unpaid (false) comes before paid (true)
        return a.is_paid ? 1 : -1
      }
      // Within the same paid status, sort by amount descending
      const amountA = Number(a.amount)
      const amountB = Number(b.amount)
      return amountB - amountA
    })
    setLocalExpenses(sorted)
  }, [expenses])

  const handlePaidToggle = async (expense: Expense, newPaidStatus: boolean) => {
    const expenseId = expense.id
    setUpdatingIds((prev) => new Set(prev).add(expenseId))

    // Optimistic update
    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId ? { ...e, is_paid: newPaidStatus } : e
    )
    setLocalExpenses(updatedExpenses)

    try {
      await updateExpensePaidStatus(expenseId, newPaidStatus)
      // Notify parent to refresh summary
      if (onExpenseUpdate) {
        onExpenseUpdate(expenseId, newPaidStatus)
      }
    } catch (error) {
      // Revert on error
      setLocalExpenses(expenses)
      console.error('Error updating expense paid status:', error)
      alert('Error al actualizar el estado de pago. Por favor, intenta de nuevo.')
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(expenseId)
        return next
      })
    }
  }

  const handleEditAmount = (expense: Expense) => {
    setEditingExpense(expense)
    setEditDialogOpen(true)
    setEditError(null)
  }

  const handleUpdateAmount = async (data: ExpenseAmountFormValues) => {
    if (!editingExpense) return

    const expenseId = editingExpense.id
    setUpdatingIds((prev) => new Set(prev).add(expenseId))

    // Optimistic update
    const updatedExpenses = localExpenses.map((e) =>
      e.id === expenseId ? { ...e, amount: data.amount } : e
    )
    setLocalExpenses(updatedExpenses)

    try {
      setEditError(null)
      await updateExpenseAmount(expenseId, data.amount)
      // Notify parent to refresh summary
      if (onExpenseUpdate) {
        // Trigger a refresh by calling with the same paid status
        onExpenseUpdate(expenseId, editingExpense.is_paid)
      }
      setEditDialogOpen(false)
      setEditingExpense(null)
    } catch (error) {
      // Revert on error
      setLocalExpenses(expenses)
      const message = error instanceof Error ? error.message : 'Error al actualizar el monto'
      setEditError(message)
      console.error('Error updating expense amount:', error)
      throw error
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(expenseId)
        return next
      })
    }
  }

  const total = localExpenses.reduce((sum, expense) => {
    return sum + Number(expense.amount)
  }, 0)

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Pagado</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin gastos
                </TableCell>
              </TableRow>
            ) : (
              <>
                {localExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <Checkbox
                        checked={expense.is_paid}
                        disabled={updatingIds.has(expense.id)}
                        onChange={(e) => {
                          e.preventDefault()
                          handlePaidToggle(expense, !expense.is_paid)
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{expense.description}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(Number(expense.amount))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditAmount(expense)}
                        disabled={updatingIds.has(expense.id)}
                        title="Modificar monto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={3} className="text-right text-sm">
                    Total:
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(total)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Expense Amount Dialog */}
      {editingExpense && (
        <EditExpenseAmountDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) {
              setEditError(null)
              setEditingExpense(null)
            }
          }}
          onSubmit={handleUpdateAmount}
          defaultAmount={Number(editingExpense.amount)}
          expenseDescription={editingExpense.description}
          fortnightLabel={fortnightLabel}
          error={editError && editDialogOpen ? editError : null}
        />
      )}
    </Card>
  )
}
