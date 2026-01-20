import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type FortnightHeaderProps = {
  year: number
  month: number
  period: 'FIRST' | 'SECOND'
  label: string
}

export default function FortnightHeader({
  year,
  month,
  period,
  label,
}: FortnightHeaderProps) {
  // Calculate previous fortnight
  let prevYear = year
  let prevMonth = month
  let prevPeriod: 'FIRST' | 'SECOND' = 'FIRST'

  if (period === 'FIRST') {
    // Previous is SECOND of previous month
    prevPeriod = 'SECOND'
    if (month === 1) {
      prevMonth = 12
      prevYear = year - 1
    } else {
      prevMonth = month - 1
    }
  } else {
    // Previous is FIRST of same month
    prevPeriod = 'FIRST'
  }

  // Calculate next fortnight
  let nextYear = year
  let nextMonth = month
  let nextPeriod: 'FIRST' | 'SECOND' = 'SECOND'

  if (period === 'FIRST') {
    // Next is SECOND of same month
    nextPeriod = 'SECOND'
  } else {
    // Next is FIRST of next month
    nextPeriod = 'FIRST'
    if (month === 12) {
      nextMonth = 1
      nextYear = year + 1
    } else {
      nextMonth = month + 1
    }
  }

  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{label}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/fortnight/${prevYear}/${prevMonth.toString().padStart(2, '0')}/${prevPeriod}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/fortnight/${nextYear}/${nextMonth.toString().padStart(2, '0')}/${nextPeriod}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
