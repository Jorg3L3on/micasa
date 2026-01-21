'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ExpenseTable from '@/components/ExpenseTable'
import SummaryBlock from '@/components/SummaryBlock'
import EmptyState from '@/components/EmptyState'
import EditFortnightAmountDialog, { OverrideAmountFormValues } from '@/components/EditFortnightAmountDialog'
import AddExpenseDialog, { AddExpenseFormValues } from '@/components/AddExpenseDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { clientFetchFromApi, updateFortnightOverrideAmount, createExpenseTransaction, createExpenseTemplate } from '@/lib/api'

type Transaction = {
  id: number
  date: string
  description: string
  amount: number | string
  category: string
  paymentMethod: string
  is_paid: boolean
}

type Summary = {
  totalIncome: number
  totalExpense: number
  totalPaid: number
  totalUnpaid: number
  balance: number
  userIncome?: Array<{
    fortnightId: number
    userIncome: Array<{ userId: number; userName: string; income: number }>
  }>
}

type FortnightColumnProps = {
  label: string
  transactions: Transaction[]
  summary: Summary
  fortnightId: number
  year: number
  month: number
  period: 'FIRST' | 'SECOND'
}

export default function FortnightColumn({
  label,
  transactions: initialTransactions,
  summary: initialSummary,
  fortnightId,
  year,
  month,
  period,
}: FortnightColumnProps) {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [addExpenseDialogOpen, setAddExpenseDialogOpen] = useState(false)
  const [addExpenseError, setAddExpenseError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const [transactionsData, summaryData] = await Promise.all([
        clientFetchFromApi<Transaction[]>(
          `/api/transactions?year=${year}&month=${String(month).padStart(2, '0')}&period=${period}`
        ),
        clientFetchFromApi<Summary>(
          `/api/reports?type=summary&year=${year}&month=${String(month).padStart(2, '0')}&period=${period}`
        ),
      ])
      setTransactions(transactionsData)
      setSummary(summaryData)
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [year, month, period])

  const handleExpenseUpdate = useCallback(
    async (expenseId: number, isPaid: boolean) => {
      // Update local state optimistically
      setTransactions((prev) =>
        prev.map((t) => (t.id === expenseId ? { ...t, is_paid: isPaid } : t))
      )

      // Refresh summary to recalculate totals
      await refreshData()
    },
    [refreshData]
  )

  const handleOverrideAmount = async (data: OverrideAmountFormValues) => {
    try {
      setOverrideError(null)
      await updateFortnightOverrideAmount(fortnightId, {
        amount: data.amount,
        year,
        month,
      })
      await refreshData()
      setOverrideDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar el monto'
      setOverrideError(message)
      throw err
    }
  }

  const handleAddExpense = async (data: AddExpenseFormValues) => {
    try {
      setAddExpenseError(null)

      // Helper to get the other fortnight ID
      const getOtherFortnightId = async (): Promise<number | null> => {
        const otherPeriod = period === 'FIRST' ? 'SECOND' : 'FIRST'
        try {
          const response = await clientFetchFromApi<{
            id: number
            label: string
            year: number
            month: number
            period: string
          }>(`/api/fortnights?year=${year}&month=${String(month).padStart(2, '0')}&period=${otherPeriod}`)
          return response.id
        } catch (error) {
          console.error('Error fetching other fortnight:', error)
          return null
        }
      }

      // Helper to get default date for a fortnight
      const getDateForFortnight = (targetPeriod: 'FIRST' | 'SECOND'): string => {
        const day = targetPeriod === 'FIRST' ? 1 : 16
        const date = new Date(year, month - 1, day)
        return date.toISOString().split('T')[0]
      }

      if (!data.isRecurring) {
        // Case 1: Non-recurring expense - create only one expense
        await createExpenseTransaction({
          fortnight_id: fortnightId,
          category_id: data.categoryId,
          description: data.name,
          amount: data.amount,
          payment_method_id: data.paymentMethodId,
          is_paid: data.isPaid,
          payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
        })
      } else if (data.isRecurring && !data.applyToBothFortnights) {
        // Case 2: Recurring, single fortnight - create expense + template
        // First create the template
        const templateResponse = await createExpenseTemplate({
          name: data.name,
          categoryId: data.categoryId,
          defaultAmount: data.amount,
          paymentMethodId: data.paymentMethodId,
          active: true,
        })
        const template = templateResponse as { id: number }

        // Then create the expense linked to the template
        await createExpenseTransaction({
          fortnight_id: fortnightId,
          category_id: data.categoryId,
          description: data.name,
          amount: data.amount,
          payment_method_id: data.paymentMethodId,
          is_paid: data.isPaid,
          payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
          expense_template_id: template.id,
        })
      } else {
        // Case 3: Recurring, both fortnights - create two expenses + one template
        const otherFortnightId = await getOtherFortnightId()
        if (!otherFortnightId) {
          throw new Error('No se pudo obtener la información de la otra quincena')
        }

        // First create the template
        const templateResponse = await createExpenseTemplate({
          name: data.name,
          categoryId: data.categoryId,
          defaultAmount: data.amount,
          paymentMethodId: data.paymentMethodId,
          active: true,
        })
        const template = templateResponse as { id: number }

        // Create expense for current fortnight
        await createExpenseTransaction({
          fortnight_id: fortnightId,
          category_id: data.categoryId,
          description: data.name,
          amount: data.amount,
          payment_method_id: data.paymentMethodId,
          is_paid: data.isPaid,
          payment_date: data.date ? `${data.date}T00:00:00.000Z` : null,
          expense_template_id: template.id,
        })

        // Create expense for the other fortnight
        const otherPeriod = period === 'FIRST' ? 'SECOND' : 'FIRST'
        const otherDate = getDateForFortnight(otherPeriod)
        await createExpenseTransaction({
          fortnight_id: otherFortnightId,
          category_id: data.categoryId,
          description: data.name,
          amount: data.amount,
          payment_method_id: data.paymentMethodId,
          is_paid: data.isPaid,
          payment_date: otherDate ? new Date(otherDate).toISOString() : null,
          expense_template_id: template.id,
        })
      }

      // Refresh data
      await refreshData()
      
      // If applied to both fortnights, refresh the server-side data to update both columns
      if (data.isRecurring && data.applyToBothFortnights) {
        router.refresh()
      }
      
      setAddExpenseDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear el gasto'
      setAddExpenseError(message)
      throw err
    }
  }

  const tenemos = summary.totalIncome
  const libre = summary.balance
  const pagado = summary.totalPaid
  const pendiente = summary.totalUnpaid

  // Filter user income for this specific fortnight
  const currentFortnightUserIncome = summary.userIncome && summary.userIncome.length > 0
    ? summary.userIncome.filter((ui) => ui.fortnightId === fortnightId)
    : undefined

  // Sort expenses: unpaid first (by amount descending), then paid (by amount descending)
  const sortedTransactions = [...transactions].sort((a, b) => {
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

  return (
    <>
      <div className="flex flex-col space-y-4">
        {/* Fortnight Header */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">{label}</CardTitle>
          </CardHeader>
        </Card>

        {/* Summary Cards */}
        <SummaryBlock
          tenemos={tenemos}
          libre={libre}
          pagado={pagado}
          pendiente={pendiente}
          userIncome={currentFortnightUserIncome}
        />

        {/* Single Expense Table for all expenses */}
        <div className="space-y-4">
          {sortedTransactions.length === 0 ? (
            <EmptyState message="No hay transacciones para esta quincena" />
          ) : (
            <ExpenseTable
              expenses={sortedTransactions}
              onExpenseUpdate={handleExpenseUpdate}
              fortnightLabel={label}
            />
          )}
        </div>

        {/* Add Expense Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => setAddExpenseDialogOpen(true)}
            className="w-full"
          >
            + Agregar gasto
          </Button>
        </div>
      </div>

      {/* Override Amount Dialog */}
      <EditFortnightAmountDialog
        open={overrideDialogOpen}
        onOpenChange={(open) => {
          setOverrideDialogOpen(open)
          setOverrideError(null)
        }}
        onSubmit={handleOverrideAmount}
        defaultAmount={tenemos}
        fortnightLabel={label}
        error={overrideError && overrideDialogOpen ? overrideError : null}
      />

      {/* Add Expense Dialog */}
      <AddExpenseDialog
        open={addExpenseDialogOpen}
        onOpenChange={(open) => {
          setAddExpenseDialogOpen(open)
          setAddExpenseError(null)
        }}
        onSubmit={handleAddExpense}
        fortnightLabel={label}
        fortnightId={fortnightId}
        year={year}
        month={month}
        period={period}
        error={addExpenseError && addExpenseDialogOpen ? addExpenseError : null}
      />
    </>
  )
}
