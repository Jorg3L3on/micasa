import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const createTransactionSchema = z.object({
  fortnight_id: z.number().int().positive(),
  card_id: z.number().int().positive().nullable().optional(),
  category_id: z.number().int().positive(),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  is_paid: z.boolean().optional().default(false),
  payment_date: z.string().datetime().nullable().optional(),
})

const updateTransactionSchema = z.object({
  fortnight_id: z.number().int().positive().optional(),
  card_id: z.number().int().positive().nullable().optional(),
  category_id: z.number().int().positive().optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  is_paid: z.boolean().optional(),
  payment_date: z.string().datetime().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const period = searchParams.get('period')
    const type = searchParams.get('type')

    const where: any = {}

    if (month || year || period) {
      const fortnightWhere: any = {}
      if (month) {
        fortnightWhere.month = parseInt(month, 10)
      }
      if (year) {
        fortnightWhere.year = parseInt(year, 10)
      }
      if (period) {
        fortnightWhere.period = period
      }
      
      // Find fortnights that match the month/year/period criteria
      const fortnights = await prisma.fortnight.findMany({
        where: fortnightWhere,
        select: { id: true },
      })
      
      const fortnightIds = fortnights.map((f) => f.id)
      if (fortnightIds.length > 0) {
        where.fortnight_id = { in: fortnightIds }
      } else {
        // No matching fortnights, return empty result
        where.fortnight_id = { in: [] }
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        card: {
          select: {
            payment_method: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    const transactions = expenses.map((expense) => ({
      id: expense.id,
      date: expense.created_at,
      description: expense.description,
      amount: expense.amount,
      category: expense.category.name,
      paymentMethod: expense.card?.payment_method?.name || 'Efectivo',
      type: 'expense',
      is_paid: expense.is_paid,
      payment_date: expense.payment_date,
    }))

    let filteredTransactions = transactions
    if (type) {
      filteredTransactions = transactions.filter((t) => t.type === type)
    }

    return NextResponse.json(filteredTransactions, { status: 200 })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createTransactionSchema.parse(body)

    if (validatedData.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    const category = await prisma.category.findUnique({
      where: { id: validatedData.category_id },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    if (validatedData.card_id) {
      const card = await prisma.card.findUnique({
        where: { id: validatedData.card_id },
        include: {
          payment_method: true,
        },
      })

      if (!card) {
        return NextResponse.json(
          { error: 'Payment method not found' },
          { status: 404 }
        )
      }
    }

    const expense = await prisma.expense.create({
      data: {
        fortnight_id: validatedData.fortnight_id,
        card_id: validatedData.card_id || null,
        category_id: validatedData.category_id,
        description: validatedData.description,
        amount: validatedData.amount,
        is_paid: validatedData.is_paid,
        payment_date: validatedData.payment_date ? new Date(validatedData.payment_date) : null,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        card: {
          select: {
            payment_method: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    const transaction = {
      id: expense.id,
      date: expense.created_at,
      description: expense.description,
      amount: expense.amount,
      category: expense.category.name,
      paymentMethod: expense.card?.payment_method?.name || 'Cash',
      type: 'expense',
      is_paid: expense.is_paid,
      payment_date: expense.payment_date,
    }

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
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
    const validatedData = updateTransactionSchema.parse(body)

    if (validatedData.amount !== undefined && validatedData.amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    if (validatedData.category_id) {
      const category = await prisma.category.findUnique({
        where: { id: validatedData.category_id },
      })

      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        )
      }
    }

    if (validatedData.card_id) {
      const card = await prisma.card.findUnique({
        where: { id: validatedData.card_id },
      })

      if (!card) {
        return NextResponse.json(
          { error: 'Payment method not found' },
          { status: 404 }
        )
      }
    }

    const updateData: any = {}
    if (validatedData.fortnight_id !== undefined) updateData.fortnight_id = validatedData.fortnight_id
    if (validatedData.card_id !== undefined) updateData.card_id = validatedData.card_id
    if (validatedData.category_id !== undefined) updateData.category_id = validatedData.category_id
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount
    if (validatedData.is_paid !== undefined) updateData.is_paid = validatedData.is_paid
    if (validatedData.payment_date !== undefined) {
      updateData.payment_date = validatedData.payment_date ? new Date(validatedData.payment_date) : null
    }

    const expense = await prisma.expense.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        card: {
          select: {
            payment_method: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    const transaction = {
      id: expense.id,
      date: expense.created_at,
      description: expense.description,
      amount: expense.amount,
      category: expense.category.name,
      paymentMethod: expense.card?.payment_method?.name || 'Cash',
      type: 'expense',
      is_paid: expense.is_paid,
      payment_date: expense.payment_date,
    }

    return NextResponse.json(transaction, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction' },
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

    await prisma.expense.delete({
      where: { id: Number(id) },
    })

    return NextResponse.json({ message: 'Transaction deleted successfully' }, { status: 200 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    console.error('Error deleting transaction:', error)
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    )
  }
}
