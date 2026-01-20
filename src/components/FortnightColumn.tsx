import ExpenseTable from '@/components/ExpenseTable'
import SummaryBlock from '@/components/SummaryBlock'
import EmptyState from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function FortnightColumn({ label, transactions, summary }: FortnightColumnProps) {
  const transactionsByDate = groupTransactionsByDate(transactions)
  const sortedDates = Object.keys(transactionsByDate).sort()

  const tenemos = summary.totalIncome
  const libre = summary.balance
  const userIncome = summary.userIncome || []

  return (
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
            <ExpenseTable key={date} date={date} expenses={transactionsByDate[date]} />
          ))
        )}
      </div>
    </div>
  )
}
