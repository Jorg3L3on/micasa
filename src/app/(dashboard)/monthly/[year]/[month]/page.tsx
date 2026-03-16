import { fetchFromApi, type OwnerContext } from '@/lib/api-server'
import MonthlyHeader from '@/components/MonthlyHeader'
import CreateNextMonthButton from '@/components/CreateNextMonthButton'
import FortnightColumn from '@/components/FortnightColumn'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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
  period: 'FIRST' | 'SECOND',
  ownerContext?: OwnerContext
): Promise<{ label: string; id: number; period: 'FIRST' | 'SECOND' } | null> {
  try {
    const response = await fetchFromApi<{
      id: number
      label: string
      year: number
      month: number
      period: string
    } | null>(`/api/fortnights?year=${year}&month=${month}&period=${period}`, ownerContext)

    if (response === null) {
      return null
    }

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
  period: 'FIRST' | 'SECOND',
  ownerContext?: OwnerContext
): Promise<Transaction[]> {
  try {
    return await fetchFromApi<Transaction[]>(
      `/api/transactions?year=${year}&month=${month}&period=${period}`,
      ownerContext
    )
  } catch (error) {
    console.error(`Error fetching transactions for ${period}:`, error)
    return []
  }
}

async function getSummary(
  year: string,
  month: string,
  period: 'FIRST' | 'SECOND',
  ownerContext?: OwnerContext
): Promise<Summary> {
  try {
    return await fetchFromApi<Summary>(
      `/api/reports?type=summary&year=${year}&month=${month}&period=${period}`,
      ownerContext
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
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>
  searchParams: Promise<{ ownerType?: string; ownerId?: string }>
}) {
  const { year: yearParam, month: monthParam } = await params
  const resolvedSearchParams = await searchParams
  const ownerContext =
    resolvedSearchParams.ownerType && resolvedSearchParams.ownerId
      ? {
          ownerType: resolvedSearchParams.ownerType as 'user' | 'house',
          ownerId: Number(resolvedSearchParams.ownerId),
        }
      : undefined

  const year = parseInt(yearParam, 10)
  const month = parseInt(monthParam, 10)
  const monthName = getMonthName(month)

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const prevMonthStr = prevMonth.toString().padStart(2, '0')
  const nextMonthStr = nextMonth.toString().padStart(2, '0')

  const ownerQuery =
    ownerContext &&
    typeof ownerContext.ownerId === 'number' &&
    ownerContext.ownerType
      ? `?ownerType=${ownerContext.ownerType}&ownerId=${ownerContext.ownerId}`
      : ''
  const prevHref = `/monthly/${prevYear}/${prevMonthStr}${ownerQuery}`
  const nextHref = `/monthly/${nextYear}/${nextMonthStr}${ownerQuery}`

  const [
    firstFortnightInfo,
    secondFortnightInfo,
    firstTransactions,
    secondTransactions,
    firstSummary,
    secondSummary,
    prevFirstInfo,
    prevSecondInfo,
    nextFirstInfo,
    nextSecondInfo,
  ] = await Promise.all([
    getFortnightInfo(yearParam, monthParam, 'FIRST', ownerContext),
    getFortnightInfo(yearParam, monthParam, 'SECOND', ownerContext),
    getTransactions(yearParam, monthParam, 'FIRST', ownerContext),
    getTransactions(yearParam, monthParam, 'SECOND', ownerContext),
    getSummary(yearParam, monthParam, 'FIRST', ownerContext),
    getSummary(yearParam, monthParam, 'SECOND', ownerContext),
    getFortnightInfo(String(prevYear), prevMonthStr, 'FIRST', ownerContext),
    getFortnightInfo(String(prevYear), prevMonthStr, 'SECOND', ownerContext),
    getFortnightInfo(String(nextYear), nextMonthStr, 'FIRST', ownerContext),
    getFortnightInfo(String(nextYear), nextMonthStr, 'SECOND', ownerContext),
  ])

  const hasPrevMonth = prevFirstInfo !== null || prevSecondInfo !== null
  const hasNextMonth = nextFirstInfo !== null || nextSecondInfo !== null

  const prevMonthLabel = `${getMonthName(prevMonth)} ${prevYear}`
  const nextMonthLabel = `${getMonthName(nextMonth)} ${nextYear}`

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const nextMonthAlreadyCreated = nextFirstInfo !== null && nextSecondInfo !== null
  const canCreateNextMonth =
    !hasNextMonth &&
    nextYear === currentYear &&
    nextMonth >= currentMonth &&
    !nextMonthAlreadyCreated

  const firstLabel = firstFortnightInfo?.label || `1–15 ${monthName} ${year}`
  const secondLabel = secondFortnightInfo?.label || `16–${new Date(year, month, 0).getDate()} ${monthName} ${year}`
  const firstFortnightId = firstFortnightInfo?.id || 0
  const secondFortnightId = secondFortnightInfo?.id || 0

  const ownerKey = ownerContext
    ? `${ownerContext.ownerType}-${ownerContext.ownerId}`
    : 'user-default'

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MonthlyHeader
          year={year}
          month={month}
          monthName={monthName}
          hasPrevMonth={hasPrevMonth}
          prevHref={prevHref}
          prevMonthLabel={prevMonthLabel}
        />
        <div className="flex items-center justify-end gap-2">
          {hasNextMonth ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <Link
                    href={nextHref}
                    aria-label={`Mes siguiente: ${nextMonthLabel}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {`Mes siguiente: ${nextMonthLabel}`}
              </TooltipContent>
            </Tooltip>
          ) : (
            <CreateNextMonthButton
              nextYear={nextYear}
              nextMonth={nextMonth}
              nextMonthLabel={nextMonthLabel}
              canCreate={canCreateNextMonth}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FortnightColumn
          key={`${ownerKey}-${year}-${month}-FIRST`}
          label={firstLabel}
          transactions={firstTransactions}
          summary={firstSummary}
          fortnightId={firstFortnightId}
          year={year}
          month={month}
          period="FIRST"
        />

        <FortnightColumn
          key={`${ownerKey}-${year}-${month}-SECOND`}
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
