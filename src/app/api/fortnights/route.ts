import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const createFortnightSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDay: z.number().int().min(1).max(31),
  endDay: z.number().int().min(1).max(31),
  active: z.boolean().optional().default(true),
})

const updateFortnightSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  startDay: z.number().int().min(1).max(31).optional(),
  endDay: z.number().int().min(1).max(31).optional(),
  active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const period = searchParams.get('period')

    // If specific params provided, return that fortnight
    if (year && month && period) {
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
    }

    // Otherwise return all fortnights for catalog
    const fortnights = await prisma.fortnight.findMany({
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { period: 'desc' },
      ],
      select: {
        id: true,
        label: true,
        start_date: true,
        end_date: true,
        closed: true,
        year: true,
        month: true,
        period: true,
      },
    })

    const formatted = fortnights.map((f) => ({
      id: f.id,
      name: f.label,
      startDay: new Date(f.start_date).getDate(),
      endDay: new Date(f.end_date).getDate(),
      active: !f.closed,
      year: f.year,
      month: f.month,
      period: f.period,
    }))

    return NextResponse.json(formatted, { status: 200 })
  } catch (error) {
    console.error('Error fetching fortnights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fortnights' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createFortnightSchema.parse(body)

    // For now, we'll create a simple fortnight entry
    // In a real system, you'd need to calculate start_date/end_date from startDay/endDay
    // This is a simplified version for the catalog
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const period = validatedData.startDay <= 15 ? 'FIRST' : 'SECOND'

    const startDate = new Date(year, month - 1, validatedData.startDay)
    const endDate = new Date(year, month - 1, validatedData.endDay)

    const fortnight = await prisma.fortnight.create({
      data: {
        label: validatedData.name,
        start_date: startDate,
        end_date: endDate,
        month,
        year,
        period: period as 'FIRST' | 'SECOND',
        closed: !validatedData.active,
      },
    })

    return NextResponse.json(
      {
        id: fortnight.id,
        name: fortnight.label,
        startDay: new Date(fortnight.start_date).getDate(),
        endDay: new Date(fortnight.end_date).getDate(),
        active: !fortnight.closed,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Fortnight with this configuration already exists' },
        { status: 409 }
      )
    }

    console.error('Error creating fortnight:', error)
    return NextResponse.json(
      { error: 'Failed to create fortnight' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updateFortnightSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name !== undefined) {
      updateData.label = validatedData.name
    }
    if (validatedData.active !== undefined) {
      updateData.closed = !validatedData.active
    }
    if (validatedData.startDay !== undefined || validatedData.endDay !== undefined) {
      const existing = await prisma.fortnight.findUnique({
        where: { id: Number(id) },
      })
      if (existing) {
        const startDay = validatedData.startDay ?? new Date(existing.start_date).getDate()
        const endDay = validatedData.endDay ?? new Date(existing.end_date).getDate()
        updateData.start_date = new Date(existing.year, existing.month - 1, startDay)
        updateData.end_date = new Date(existing.year, existing.month - 1, endDay)
      }
    }

    const fortnight = await prisma.fortnight.update({
      where: { id: Number(id) },
      data: updateData,
    })

    return NextResponse.json(
      {
        id: fortnight.id,
        name: fortnight.label,
        startDay: new Date(fortnight.start_date).getDate(),
        endDay: new Date(fortnight.end_date).getDate(),
        active: !fortnight.closed,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 }
      )
    }

    console.error('Error updating fortnight:', error)
    return NextResponse.json(
      { error: 'Failed to update fortnight' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 }
      )
    }

    // Check for related expenses
    const relatedExpenses = await prisma.expense.findFirst({
      where: { fortnight_id: Number(id) },
    })

    if (relatedExpenses) {
      return NextResponse.json(
        { error: 'Fortnight is in use and cannot be deleted' },
        { status: 409 }
      )
    }

    await prisma.fortnight.delete({
      where: { id: Number(id) },
    })

    return NextResponse.json({ message: 'Fortnight deleted successfully' }, { status: 200 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 }
      )
    }

    console.error('Error deleting fortnight:', error)
    return NextResponse.json(
      { error: 'Failed to delete fortnight' },
      { status: 500 }
    )
  }
}
