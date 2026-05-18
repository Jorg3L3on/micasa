import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createBudget } from '@/lib/finance/budget.service';
import { listActivePeriods } from '@/lib/finance/budget-period.service';
import { createBudgetSchema } from '@/schemas/budget.schema';

type ErrorWithCode = Error & { code?: string };

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const periods = await listActivePeriods(ownerFilter, new Date());
    return NextResponse.json(periods, { status: 200 });
  } catch (error) {
    console.error('Error fetching active budget periods:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const body = await request.json();
    const data = createBudgetSchema.parse(body);

    const budget = await createBudget(ownerType, ownerId, data);
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as ErrorWithCode).code === 'ALLOC_EXCEEDS_BUDGET'
    ) {
      return NextResponse.json(
        { error: (error as ErrorWithCode).message },
        { status: 422 },
      );
    }
    console.error('Error creating budget:', error);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
