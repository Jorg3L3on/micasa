import { fetchFromApi } from '@/lib/api-server'
import FortnightHeader from '@/components/FortnightHeader'
import ExpenseTable from '@/components/ExpenseTable'
import SummaryBlock from '@/components/SummaryBlock'
import EmptyState from '@/components/EmptyState'

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

async function getFortnightLabel(
  year: string,
  month: string,
  period: string
): Promise<string> {
  try {
    const response = await fetchFromApi<{ label: string }>(
      `/api/fortnights?year=${year}&month=${month}&period=${period}`
    )
    return response.label
  } catch (error) {
    console.error('Error fetching fortnight label:', error)
    return `${month}/${year} - ${period}`
  }
}

async function getTransactions(
  year: string,
  month: string,
  period: string
): Promise<Transaction[]> {
  try {
    return await fetchFromApi<Transaction[]>(
      `/api/transactions?year=${year}&month=${month}&period=${period}`
    )
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

async function getSummary(
  year: string,
  month: string,
  period: string
): Promise<Summary> {
  try {
    return await fetchFromApi<Summary>(
      `/api/reports?type=summary&year=${year}&month=${month}&period=${period}`
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



export default async function FortnightPage({
  params,
}: {
  params: Promise<{ year: string; month: string; period: string }>
}) {
  const { year: yearParam, month: monthParam, period: periodParam } = await params
  const year = parseInt(yearParam, 10)
  const month = parseInt(monthParam, 10)
  const period = periodParam.toUpperCase() as 'FIRST' | 'SECOND'

  const [fortnightLabel, transactions, summary] = await Promise.all([
    getFortnightLabel(yearParam, monthParam, periodParam),
    getTransactions(yearParam, monthParam, periodParam),
    getSummary(yearParam, monthParam, periodParam),
  ])

  const transactionsByDate = groupTransactionsByDate(transactions)
  const sortedDates = Object.keys(transactionsByDate).sort()

  const tenemos = summary.totalIncome
  const libre = summary.balance
  const pagado = summary.totalPaid
  const pendiente = summary.totalUnpaid

  return (
    <>
      <FortnightHeader
        year={year}
        month={month}
        period={period}
        label={fortnightLabel}
      />

      <div className="space-y-6">
        {/* TOP SECTION - Summary Cards */}
        <SummaryBlock
          tenemos={tenemos}
          libre={libre}
          pagado={pagado}
          pendiente={pendiente}
        />

        {/* BOTTOM SECTION - Expense Tables */}
        <div className="space-y-6">
          {sortedDates.length === 0 ? (
            <EmptyState message="No hay transacciones para esta quincena" />
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
      </div>
    </>
  )
}
