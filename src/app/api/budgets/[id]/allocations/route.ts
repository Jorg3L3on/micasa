import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { updateBudgetAllocations } from '@/lib/finance/budget.service';
import { updateBudgetAllocationsSchema } from '@/schemas/budget.schema';

type ErrorWithCode = Error & { code?: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { allocations } = updateBudgetAllocationsSchema.parse(body);

    const budget = await updateBudgetAllocations(id, ownerFilter, allocations);
    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const errorWithCode = error as ErrorWithCode;
      const code = errorWithCode.code;
      if (code === 'P2025') {
        return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
      }
      if (code === 'ALLOC_EXCEEDS_BUDGET') {
        return NextResponse.json({ error: errorWithCode.message }, { status: 422 });
      }
    }
    console.error('Error updating budget allocations:', error);
    return NextResponse.json({ error: 'Failed to update allocations' }, { status: 500 });
  }
}
