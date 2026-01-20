import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const createPaymentMethodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['CARD', 'CASH']),
})

const updatePaymentMethodSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  type: z.enum(['CARD', 'CASH']).optional(),
})

export async function GET() {
  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(paymentMethods, { status: 200 })
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createPaymentMethodSchema.parse(body)

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        name: validatedData.name,
        type: validatedData.type,
      },
    })

    return NextResponse.json(paymentMethod, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Payment method with this name already exists' },
        { status: 409 }
      )
    }

    console.error('Error creating payment method:', error)
    return NextResponse.json(
      { error: 'Failed to create payment method' },
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
    const validatedData = updatePaymentMethodSchema.parse(body)

    const updateData: { name?: string; type?: 'CARD' | 'CASH' } = {}
    if (validatedData.name) {
      updateData.name = validatedData.name
    }
    if (validatedData.type) {
      updateData.type = validatedData.type
    }

    const paymentMethod = await prisma.paymentMethod.update({
      where: { id: Number(id) },
      data: updateData,
    })

    return NextResponse.json(paymentMethod, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Payment method with this name already exists' },
        { status: 409 }
      )
    }

    console.error('Error updating payment method:', error)
    return NextResponse.json(
      { error: 'Failed to update payment method' },
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

    await prisma.paymentMethod.delete({
      where: { id: Number(id) },
    })

    return NextResponse.json({ message: 'Payment method deleted successfully' }, { status: 200 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Cannot delete payment method with related records' },
        { status: 409 }
      )
    }

    console.error('Error deleting payment method:', error)
    return NextResponse.json(
      { error: 'Failed to delete payment method' },
      { status: 500 }
    )
  }
}
