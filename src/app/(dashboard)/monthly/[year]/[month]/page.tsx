import { fetchFromApi } from '@/lib/api-server'
import MonthlyHeader from '@/components/MonthlyHeader'
import ExpenseTable from '@/components/ExpenseTable'
import SummaryBlock from '@/components/SummaryBlock'
import PaymentBreakdownTable from '@/components/PaymentBreakdownTable'
import BalanceTable from '@/components/BalanceTable'
import SectionCard from '@/components/SectionCard'
import EmptyState from '@/components/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
}

type PaymentMethodTotal = {
  method: string
  total: number
}

type PersonTotal = {
  person: string
  total: number
}

function getMonthName(month: number): string {
  const months = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  return months[month - 1] || ''
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

async function getTransactions(year: string, month: string): Promise<Transaction[]> {
  try {
    return await fetchFromApi<Transaction[]>(
      `/api/transactions?year=${year}&month=${month}`
    )
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

async function getSummary(year: string, month: string): Promise<Summary> {
  try {
    return await fetchFromApi<Summary>(
      `/api/reports?type=summary&year=${year}&month=${month}`
    )
  } catch (error) {
    console.error('Error fetching summary:', error)
    return {
      totalIncome: 0,
      totalExpense: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      balance: 0,
    }
  }
}

async function getPaymentMethodBreakdown(
  year: string,
  month: string
): Promise<PaymentMethodTotal[]> {
  try {
    return await fetchFromApi<PaymentMethodTotal[]>(
      `/api/reports?type=by-payment-method&year=${year}&month=${month}`
    )
  } catch (error) {
    console.error('Error fetching payment method breakdown:', error)
    return []
  }
}

async function getPersonBreakdown(year: string, month: string): Promise<PersonTotal[]> {
  try {
    return await fetchFromApi<PersonTotal[]>(
      `/api/reports?type=by-person&year=${year}&month=${month}`
    )
  } catch (error) {
    console.error('Error fetching person breakdown:', error)
    return []
  }
}

export default async function MonthlyPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>
}) {
  const { year: yearParam, month: monthParam } = await params
  const year = parseInt(yearParam, 10)
  const month = parseInt(monthParam, 10)
  const monthName = getMonthName(month)

  const [transactions, summary, paymentMethods, personBalances] = await Promise.all([
    getTransactions(yearParam, monthParam),
    getSummary(yearParam, monthParam),
    getPaymentMethodBreakdown(yearParam, monthParam),
    getPersonBreakdown(yearParam, monthParam),
  ])

  const transactionsByDate = groupTransactionsByDate(transactions)
  const sortedDates = Object.keys(transactionsByDate).sort()

  const tenemos = summary.totalIncome
  const total = summary.totalExpense
  const libre = summary.balance

  // Convert personBalances to userIncome format
  const userIncome = personBalances.map((p) => ({
    user: p.person,
    amount: p.total,
  }))

  return (
    <>
      <MonthlyHeader year={year} month={month} monthName={monthName} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - Expense Tables */}
        <div className="lg:col-span-2 space-y-6">
          {sortedDates.length === 0 ? (
            <EmptyState message="No hay transacciones para este mes" />
          ) : (
            sortedDates.map((date) => (
              <ExpenseTable
                key={date}
                date={date}
                expenses={transactionsByDate[date]}
              />
            ))
          )}
        </div>

        {/* RIGHT COLUMN - Summary Cards */}
        <div className="space-y-6">
          <SummaryBlock tenemos={tenemos} libre={libre} userIncome={userIncome} />

          <PaymentBreakdownTable methods={paymentMethods} />

          <SectionCard
            title="Tenemos – Por Pagar"
            amount={summary.totalUnpaid}
            variant="warning"
            description="Monto aún sin pagar"
          />

          <Card>
            <CardHeader>
              <CardTitle>Por Gastar / Ahorrar</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-muted-foreground">
                      (Sección para gastos planificados)
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      -
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <BalanceTable title="Debemos Tener" balances={personBalances} />
        </div>
      </div>
    </>
  )
}
