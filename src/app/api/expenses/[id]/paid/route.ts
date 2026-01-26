import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { updatePaidSchema } from '@/schemas/transaction.schema'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { error: 'Valid id parameter is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = updatePaidSchema.parse(body)

    const expense = await prisma.expense.update({
      where: { id: Number(id) },
      data: {
        is_paid: validatedData.paid,
        payment_date: validatedData.paid ? new Date() : null,
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

    return NextResponse.json(
      {
        id: expense.id,
        date: expense.created_at,
        description: expense.description,
        amount: expense.amount,
        category: expense.category.name,
        paymentMethod: expense.card?.payment_method?.name || 'Efectivo',
        is_paid: expense.is_paid,
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
        { error: 'Expense not found' },
        { status: 404 }
      )
    }

    console.error('Error updating expense paid status:', error)
    return NextResponse.json(
      { error: 'Failed to update expense paid status' },
      { status: 500 }
    )
  }
}
