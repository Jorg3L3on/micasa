'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_PANEL_SHELL_CLASS,
} from '@/components/monthly/monthly-panel-shell'
import {
  formatFortnightDateRangeLabel,
  formatFortnightOrdinalTitle,
} from '@/lib/fortnight-calendar'
import { cn } from '@/lib/utils'

type FortnightPeriod = 'FIRST' | 'SECOND'

type FortnightHeaderProps = {
  year: number
  month: number
  period: FortnightPeriod
  actions?: ReactNode
}

type FortnightNavLinkProps = {
  href: string
  label: string
  direction: 'prev' | 'next'
}

const FortnightNavLink = ({ href, label, direction }: FortnightNavLinkProps) => {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-lg" asChild>
          <Link href={href} aria-label={label}>
            <Icon
              className="size-5 shrink-0"
              strokeWidth={2.25}
              aria-hidden
              data-icon={direction === 'prev' ? 'inline-start' : 'inline-end'}
            />
            <span className="sr-only">{label}</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export default function FortnightHeader({
  year,
  month,
  period,
  actions,
}: FortnightHeaderProps) {
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const suffix = queryString ? `?${queryString}` : ''
  let prevYear = year
  let prevMonth = month
  let prevPeriod: FortnightPeriod = 'FIRST'

  if (period === 'FIRST') {
    prevPeriod = 'SECOND'
    if (month === 1) {
      prevMonth = 12
      prevYear = year - 1
    } else {
      prevMonth = month - 1
    }
  } else {
    prevPeriod = 'FIRST'
  }

  let nextYear = year
  let nextMonth = month
  let nextPeriod: FortnightPeriod = 'SECOND'

  if (period === 'FIRST') {
    nextPeriod = 'SECOND'
  } else {
    nextPeriod = 'FIRST'
    if (month === 12) {
      nextMonth = 1
      nextYear = year + 1
    } else {
      nextMonth = month + 1
    }
  }

  const buildHref = (y: number, m: number, p: FortnightPeriod) =>
    `/fortnight/${y}/${m.toString().padStart(2, '0')}/${p}${suffix}`

  const prevLabel = `Quincena anterior: ${formatFortnightDateRangeLabel(prevYear, prevMonth, prevPeriod)}`
  const nextLabel = `Quincena siguiente: ${formatFortnightDateRangeLabel(nextYear, nextMonth, nextPeriod)}`

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2',
        MONTHLY_PANEL_SHELL_CLASS,
        MONTHLY_CHROME_PADDING_CLASS,
      )}
    >
      <div
        className="flex min-w-0 items-center gap-1"
        role="group"
        aria-label="Selector de quincena"
      >
        <FortnightNavLink
          href={buildHref(prevYear, prevMonth, prevPeriod)}
          label={prevLabel}
          direction="prev"
        />
        <FortnightNavLink
          href={buildHref(nextYear, nextMonth, nextPeriod)}
          label={nextLabel}
          direction="next"
        />
        <div className="min-w-0">
          <h1 className="text-balance text-title sm:truncate">
            {formatFortnightOrdinalTitle(period, month, year)}
          </h1>
          <p className="text-balance text-caption text-muted-foreground sm:truncate">
            {formatFortnightDateRangeLabel(year, month, period)}
          </p>
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2 sm:shrink-0">{actions}</div>
      ) : null}
    </div>
  )
}
