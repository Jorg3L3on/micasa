import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const createExpenseTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.number().int().positive(),
  suggestedAmount: z.number().positive().optional(),
  paymentMethodId: z.number().int().positive().optional(),
  active: z.boolean().optional().default(true),
  expenseIds: z.array(z.number().int().positive()).optional().default([]),
})

const updateExpenseTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  categoryId: z.number().int().positive().optional(),
  suggestedAmount: z.number().positive().optional(),
  paymentMethodId: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
  expenseIds: z.array(z.number().int().positive()).optional(),
})

export async function GET() {
  try {
    const templates = await prisma.expenseTemplate.findMany({
      include: {
        category: {
          select: {
            name: true,
          },
        },
        default_card: {
          select: {
            payment_method: {
              select: {
                name: true,
              },
            },
          },
        },
        expenses: {
          select: {
            id: true,
            amount: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    const formatted = templates.map((template) => {
      // Calculate total from suggested_amount or sum of related transactional expenses
      const totalAmount = template.suggested_amount
        ? Number(template.suggested_amount)
        : template.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)

      return {
        id: template.id,
        name: template.name,
        category: template.category.name,
        suggestedAmount: template.suggested_amount ? Number(template.suggested_amount) : null,
        paymentMethod: template.default_card?.payment_method?.name || null,
        active: template.active,
        totalEstimatedAmount: totalAmount,
        expenseIds: [], // Will be populated from form selections in UI
      }
    })

    return NextResponse.json(formatted, { status: 200 })
  } catch (error) {
    console.error('Error fetching expense templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expense templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createExpenseTemplateSchema.parse(body)

    // Get a card for the payment method if provided
    let defaultCardId = null
    if (validatedData.paymentMethodId) {
      const card = await prisma.card.findFirst({
        where: {
          payment_method_id: validatedData.paymentMethodId,
          active: true,
        },
      })
      defaultCardId = card?.id || null
    }

    const template = await prisma.expenseTemplate.create({
      data: {
        name: validatedData.name,
        category_id: validatedData.categoryId,
        suggested_amount: validatedData.suggestedAmount
          ? validatedData.suggestedAmount.toString()
          : null,
        default_card_id: defaultCardId,
        active: validatedData.active ?? true,
      },
      include: {
        category: {
          select: {
            name: true,
          },
        },
        default_card: {
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
        id: template.id,
        name: template.name,
        category: template.category.name,
        defaultAmount: template.suggested_amount ? Number(template.suggested_amount) : null,
        paymentMethod: template.default_card?.payment_method?.name || null,
        active: template.active,
        totalEstimatedAmount: template.suggested_amount ? Number(template.suggested_amount) : 0,
        expenseIds: [],
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
        { error: 'Expense template with this name already exists' },
        { status: 409 }
      )
    }

    console.error('Error creating expense template:', error)
    return NextResponse.json(
      { error: 'Failed to create expense template' },
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
    const validatedData = updateExpenseTemplateSchema.parse(body)

    const updateData: any = {}
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name
    }
    if (validatedData.categoryId !== undefined) {
      updateData.category_id = validatedData.categoryId
    }
    if (validatedData.suggestedAmount !== undefined) {
      updateData.suggested_amount = validatedData.suggestedAmount.toString()
    }
    if (validatedData.active !== undefined) {
      updateData.active = validatedData.active
    }
    if (validatedData.paymentMethodId !== undefined) {
      if (validatedData.paymentMethodId === null) {
        updateData.default_card_id = null
      } else {
        const card = await prisma.card.findFirst({
          where: {
            payment_method_id: validatedData.paymentMethodId,
            active: true,
          },
        })
        updateData.default_card_id = card?.id || null
      }
    }

    const template = await prisma.expenseTemplate.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
          },
        },
        default_card: {
          select: {
            payment_method: {
              select: {
                name: true,
              },
            },
          },
        },
        expenses: {
          select: {
            id: true,
            amount: true,
          },
        },
      },
    })

    const totalAmount = template.expenses.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0
    )

    return NextResponse.json(
      {
        id: template.id,
        name: template.name,
        category: template.category.name,
        suggestedAmount: template.suggested_amount ? Number(template.suggested_amount) : null,
        paymentMethod: template.default_card?.payment_method?.name || null,
        active: template.active,
        totalEstimatedAmount: totalAmount || (template.suggested_amount ? Number(template.suggested_amount) : 0),
        expenseIds: template.expenses.map((e) => e.id),
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
        { error: 'Expense template not found' },
        { status: 404 }
      )
    }

    console.error('Error updating expense template:', error)
    return NextResponse.json(
      { error: 'Failed to update expense template' },
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
      where: { expense_template_id: Number(id) },
    })

    if (relatedExpenses) {
      return NextResponse.json(
        { error: 'Expense template is in use and cannot be deleted' },
        { status: 409 }
      )
    }

    await prisma.expenseTemplate.delete({
      where: { id: Number(id) },
    })

    return NextResponse.json(
      { message: 'Expense template deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Expense template not found' },
        { status: 404 }
      )
    }

    console.error('Error deleting expense template:', error)
    return NextResponse.json(
      { error: 'Failed to delete expense template' },
      { status: 500 }
    )
  }
}
