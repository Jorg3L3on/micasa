import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const period = searchParams.get('period')

    if (!year || !month || !period) {
      return NextResponse.json(
        { error: 'Year, month, and period are required' },
        { status: 400 }
      )
    }

    const fortnight = await prisma.fortnight.findUnique({
      where: {
        year_month_period: {
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          period: period.toUpperCase() as 'FIRST' | 'SECOND',
        },
      },
      select: { label: true },
    })

    if (!fortnight) {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ label: fortnight.label }, { status: 200 })
  } catch (error) {
    console.error('Error fetching fortnight:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fortnight' },
      { status: 500 }
    )
  }
}
