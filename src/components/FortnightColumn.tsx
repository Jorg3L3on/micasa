'use client'

import { useState, useCallback } from 'react'
import ExpenseTable from '@/components/ExpenseTable'
import SummaryBlock from '@/components/SummaryBlock'
import EmptyState from '@/components/EmptyState'
import EditFortnightAmountDialog, { OverrideAmountFormValues } from '@/components/EditFortnightAmountDialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { clientFetchFromApi, updateFortnightOverrideAmount } from '@/lib/api'

type Transaction = {
  id: number
  date: string
  description: string
  amount: number | string
  category: string
  paymentMethod: string
  is_paid: boolean
  user: string
}

type Summary = {
  totalIncome: number
  totalExpense: number
  totalPaid: number
  totalUnpaid: number
  balance: number
  userIncome?: Array<{ user: string; amount: number }>
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

function groupTransactionsByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date).toISOString().split('T')[0]
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(transaction)
    return acc
  }, {} as Record<string, Transaction[]>)
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
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [summary, setSummary] = useState<Summary>(initialSummary)
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  const transactionsByDate = groupTransactionsByDate(transactions)
  const sortedDates = Object.keys(transactionsByDate).sort()

  const tenemos = summary.totalIncome
  const libre = summary.balance
  const userIncome = summary.userIncome || []

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
        <SummaryBlock tenemos={tenemos} libre={libre} userIncome={userIncome} />

        {/* Expense Tables */}
        <div className="space-y-4">
          {sortedDates.length === 0 ? (
            <EmptyState message="No hay transacciones para esta quincena" />
          ) : (
            sortedDates.map((date) => (
              <ExpenseTable
                key={date}
                date={date}
                expenses={transactionsByDate[date]}
                onExpenseUpdate={handleExpenseUpdate}
                fortnightLabel={label}
              />
            ))
          )}
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
    </>
  )
}
