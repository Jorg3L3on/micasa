import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { setBudgetActive } from '@/lib/finance/budget.service';
import { setBudgetActiveSchema } from '@/schemas/budget.schema';

type ErrorWithCode = Error & { code?: string };

export async function PATCH(
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
    const { active } = setBudgetActiveSchema.parse(body);
    const budget = await setBudgetActive(id, ownerFilter, active);
    return NextResponse.json(budget, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as ErrorWithCode).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    }
    console.error('Error updating budget active state:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}
