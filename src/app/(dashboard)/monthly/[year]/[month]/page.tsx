import { fetchFromApi } from '@/lib/api-server'
import MonthlyHeader from '@/components/MonthlyHeader'
import FortnightColumn from '@/components/FortnightColumn'

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

type FortnightInfo = {
  label: string
  id: number
  period: 'FIRST' | 'SECOND'
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

async function getFortnightInfo(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND'
): Promise<{ label: string; id: number; period: 'FIRST' | 'SECOND' } | null> {
  try {
    const response = await fetchFromApi<{
      id: number
      label: string
      year: number
      month: number
      period: string
    }>(`/api/fortnights?year=${year}&month=${month}&period=${period}`)
    
    return {
      label: response.label,
      id: response.id,
      period: period,
    }
  } catch (error) {
    console.error(`Error fetching fortnight ${period}:`, error)
    return null
  }
}

async function getTransactions(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND'
): Promise<Transaction[]> {
  try {
    return await fetchFromApi<Transaction[]>(
      `/api/transactions?year=${year}&month=${month}&period=${period}`
    )
  } catch (error) {
    console.error(`Error fetching transactions for ${period}:`, error)
    return []
  }
}

async function getSummary(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND'
): Promise<Summary> {
  try {
    return await fetchFromApi<Summary>(
      `/api/reports?type=summary&year=${year}&month=${month}&period=${period}`
    )
  } catch (error) {
    console.error(`Error fetching summary for ${period}:`, error)
    return {
      totalIncome: 0,
      totalExpense: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      balance: 0,
    }
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

  const [
    firstFortnightInfo,
    secondFortnightInfo,
    firstTransactions,
    secondTransactions,
    firstSummary,
    secondSummary,
  ] = await Promise.all([
    getFortnightInfo(yearParam, monthParam, 'FIRST'),
    getFortnightInfo(yearParam, monthParam, 'SECOND'),
    getTransactions(yearParam, monthParam, 'FIRST'),
    getTransactions(yearParam, monthParam, 'SECOND'),
    getSummary(yearParam, monthParam, 'FIRST'),
    getSummary(yearParam, monthParam, 'SECOND'),
  ])

  const firstLabel = firstFortnightInfo?.label || `1–15 ${monthName} ${year}`
  const secondLabel = secondFortnightInfo?.label || `16–${new Date(year, month, 0).getDate()} ${monthName} ${year}`
  const firstFortnightId = firstFortnightInfo?.id || 0
  const secondFortnightId = secondFortnightInfo?.id || 0

  return (
    <>
      <MonthlyHeader year={year} month={month} monthName={monthName} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FortnightColumn
          label={firstLabel}
          transactions={firstTransactions}
          summary={firstSummary}
          fortnightId={firstFortnightId}
          year={year}
          month={month}
          period="FIRST"
        />

        <FortnightColumn
          label={secondLabel}
          transactions={secondTransactions}
          summary={secondSummary}
          fortnightId={secondFortnightId}
          year={year}
          month={month}
          period="SECOND"
        />
      </div>
    </>
  )
}
