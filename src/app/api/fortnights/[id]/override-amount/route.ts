import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const overrideAmountSchema = z.object({
  amount: z.number().min(0, 'Amount must be greater than or equal to 0'),
  year: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
})

export async function PUT(
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
    const validatedData = overrideAmountSchema.parse(body)

    // Find the fortnight
    const fortnight = await prisma.fortnight.findUnique({
      where: { id: Number(id) },
    })

    if (!fortnight) {
      return NextResponse.json(
        { error: 'Fortnight not found' },
        { status: 404 }
      )
    }

    // Verify the fortnight matches the year/month
    if (fortnight.year !== validatedData.year || fortnight.month !== validatedData.month) {
      return NextResponse.json(
        { error: 'Fortnight year/month mismatch' },
        { status: 400 }
      )
    }

    // NOTE: The current schema does not have a dedicated field for storing
    // fortnight-specific amount overrides. A proper implementation would require:
    // 1. Adding an `override_amount` Decimal field to the Fortnight model, OR
    // 2. Creating a separate FortnightOverride table
    //
    // For this implementation, we'll use a workaround by storing the override
    // in FortnightIncome with a special source marker. This allows retrieval
    // while maintaining data integrity. The reports API will need to check for
    // this override when calculating "Tenemos".
    //
    // TODO: Add proper schema support for override amounts

    // Delete existing override (marked with source = '__OVERRIDE__')
    await prisma.fortnightIncome.deleteMany({
      where: {
        fortnight_id: Number(id),
        source: '__OVERRIDE__',
      },
    })

    // Create override entry (using first user as placeholder - override applies to total)
    const firstUser = await prisma.user.findFirst({
      where: { active: true },
      orderBy: { id: 'asc' },
    })

    if (!firstUser) {
      return NextResponse.json(
        { error: 'No active user found' },
        { status: 400 }
      )
    }

    await prisma.fortnightIncome.create({
      data: {
        fortnight_id: Number(id),
        user_id: firstUser.id,
        amount: validatedData.amount.toString(),
        source: '__OVERRIDE__',
      },
    })

    return NextResponse.json(
      {
        message: 'Override amount saved successfully',
        amount: validatedData.amount,
        fortnightId: Number(id),
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

    console.error('Error saving override amount:', error)
    return NextResponse.json(
      { error: 'Failed to save override amount' },
      { status: 500 }
    )
  }
}
