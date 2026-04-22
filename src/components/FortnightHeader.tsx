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

type FortnightHeaderProps = {
  year: number
  month: number
  period: 'FIRST' | 'SECOND'
  label: string
  actions?: ReactNode
}

export default function FortnightHeader({
  year,
  month,
  period,
  label,
  actions,
}: FortnightHeaderProps) {
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()
  const suffix = queryString ? `?${queryString}` : ''
  let prevYear = year
  let prevMonth = month
  let prevPeriod: 'FIRST' | 'SECOND' = 'FIRST'

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
  let nextPeriod: 'FIRST' | 'SECOND' = 'SECOND'

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

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{label}</h1>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Selector de quincena"
        >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-lg" asChild>
              <Link
                href={`/fortnight/${prevYear}/${prevMonth.toString().padStart(2, '0')}/${prevPeriod}${suffix}`}
                aria-label="Quincena anterior"
              >
                <ChevronLeft
                  className="size-5 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            Quincena anterior
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-lg" asChild>
              <Link
                href={`/fortnight/${nextYear}/${nextMonth.toString().padStart(2, '0')}/${nextPeriod}${suffix}`}
                aria-label="Quincena siguiente"
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
            Quincena siguiente
          </TooltipContent>
        </Tooltip>
        </div>
      </div>
    </div>
  )
}
