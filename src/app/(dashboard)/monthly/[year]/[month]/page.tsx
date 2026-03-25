import { fetchFromApi, type OwnerContext } from '@/lib/api-server'
import MonthlyHeader from '@/components/MonthlyHeader'
import CreateNextMonthButton from '@/components/CreateNextMonthButton'
import MonthlyFortnightView from '@/components/MonthlyFortnightView'
import WalletBalanceStrip from '../../../../../components/WalletBalanceStrip'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  WalletListItem,
  DuePaymentItem,
  PlannerDuePaymentsResponse,
  PlannerCardChargesSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerCardStatementDueSummary,
} from '@/types/catalog'

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
  planningExpenseCount?: number
  planningPaidExpenseCount?: number
  planningUnpaidExpenseCount?: number
  cardCharges?: PlannerCardChargesSummary | null
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null
  planningCardStatementDue?: PlannerCardStatementDueSummary | null
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
      `/api/transactions?year=${year}&month=${month}&period=${period}&type=expense&exclude_credit_msi=true`,
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
      `/api/reports?type=summary&year=${year}&month=${month}&period=${period}&exclude_credit_msi=true`,
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

async function getWallets(ownerContext?: OwnerContext): Promise<WalletListItem[]> {
  try {
    const wallets = await fetchFromApi<WalletListItem[]>('/api/wallets', ownerContext)
    return wallets
      .filter((w) => w.active)
      .map((w) => {
        if (w.type === 'CREDIT_CARD' || w.type === 'DEPARTMENT_STORE_CARD') {
          const creditLimit = w.credit_limit ?? 0
          const available = creditLimit - w.amount
          return {
            ...w,
            amount: available,
          }
        }
        return w
      })
  } catch (error) {
    console.error('Error fetching wallets:', error)
    return []
  }
}

async function getDuePayments(ownerContext?: OwnerContext): Promise<DuePaymentItem[]> {
  try {
    return await fetchFromApi<DuePaymentItem[]>('/api/wallets/due-payments', ownerContext)
  } catch (error) {
    console.error('Error fetching due payments:', error)
    return []
  }
}

async function getPlannerDuePayments(
  year: number,
  month: number,
  ownerContext?: OwnerContext,
): Promise<PlannerDuePaymentsResponse> {
  try {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    })
    return await fetchFromApi<PlannerDuePaymentsResponse>(
      `/api/wallets/due-payments?${params.toString()}`,
      ownerContext,
    )
  } catch (error) {
    console.error('Error fetching planner due payments:', error)
    return { first: [], second: [] }
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

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isCurrentMonth = year === currentYear && month === currentMonth

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
    wallets,
    duePayments,
    plannerDue,
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
    getWallets(ownerContext),
    isCurrentMonth ? getDuePayments(ownerContext) : Promise.resolve([] as DuePaymentItem[]),
    getPlannerDuePayments(year, month, ownerContext),
  ])

  const hasPrevMonth = prevFirstInfo !== null || prevSecondInfo !== null
  const hasNextMonth = nextFirstInfo !== null || nextSecondInfo !== null

  const prevMonthLabel = `${getMonthName(prevMonth)} ${prevYear}`
  const nextMonthLabel = `${getMonthName(nextMonth)} ${nextYear}`

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

  const dueWalletIds = duePayments.map((dp) => dp.walletId)
  const currentDay = now.getDate()
  const isFirstFortnight = currentDay <= 15
  const suggestedPeriod: 'FIRST' | 'SECOND' =
    isCurrentMonth && currentDay <= 15
      ? 'FIRST'
      : isCurrentMonth
        ? 'SECOND'
        : 'FIRST'
  const paidWalletIds = isCurrentMonth
    ? wallets
        .filter((w) => {
          if (w.type !== 'CREDIT_CARD' && w.type !== 'DEPARTMENT_STORE_CARD') return false
          if (w.due_day == null) return false
          const dueInFortnight = isFirstFortnight
            ? w.due_day >= 1 && w.due_day <= 15
            : w.due_day >= 16
          return dueInFortnight && !dueWalletIds.includes(w.id)
        })
        .map((w) => w.id)
    : []

  const cardDueFirst = plannerDue.first
  const cardDueSecond = plannerDue.second

  return (
    <>
      <div
        className="mb-3 flex items-center gap-2 sm:gap-3"
        role="group"
        aria-label="Selector de mes"
      >
        <div className="shrink-0">
          <MonthlyHeader
            year={year}
            month={month}
            monthName={monthName}
            hasPrevMonth={hasPrevMonth}
            prevHref={prevHref}
            prevMonthLabel={prevMonthLabel}
          />
        </div>

        <h1
          className="min-w-0 flex-1 truncate text-center text-xl font-bold sm:text-2xl"
          aria-live="polite"
        >
          {monthName} {year}
        </h1>

        <div className="shrink-0">
          {hasNextMonth ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-lg" asChild>
                  <Link
                    href={nextHref}
                    aria-label={`Ir al mes siguiente: ${nextMonthLabel}`}
                  >
                    <ChevronRight
                      className="size-5 shrink-0"
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {`Ir al mes siguiente (${nextMonthLabel})`}
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

      <div className="mb-4 min-w-0">
        <WalletBalanceStrip wallets={wallets} paidWalletIds={paidWalletIds} />
      </div>

      <MonthlyFortnightView
        ownerKey={ownerKey}
        year={year}
        month={month}
        suggestedPeriod={suggestedPeriod}
        first={{
          label: firstLabel,
          transactions: firstTransactions,
          summary: firstSummary,
          fortnightId: firstFortnightId,
          cardDueItems: cardDueFirst,
        }}
        second={{
          label: secondLabel,
          transactions: secondTransactions,
          summary: secondSummary,
          fortnightId: secondFortnightId,
          cardDueItems: cardDueSecond,
        }}
      />
    </>
  )
}
