import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import {
  clearBudgetFortnightAdjustment,
  setBudgetFortnightAdjustment,
} from '@/lib/finance/budget-adjustment.service';
import { DomainError } from '@/lib/finance/domain-error';
import {
  budgetFortnightAdjustmentSchema,
  budgetQuincenaRefSchema,
} from '@/schemas/budget.schema';

/** One-quincena budget adjustments (MIC-I19). The template is never changed. */

const parseId = async (params: Promise<{ id: string }>) => {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? 'Datos inválidos', details: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await withOwnerContext(request, async ({ ownerFilter }) => {
      const id = await parseId(params);
      if (id == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
      const input = budgetFortnightAdjustmentSchema.parse(await request.json());
      const adjustment = await setBudgetFortnightAdjustment(id, ownerFilter, input);
      return NextResponse.json(adjustment, { status: 200 });
    });
  } catch (error) {
    return errorResponse(error, 'No se pudo guardar el ajuste');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await withOwnerContext(request, async ({ ownerFilter }) => {
      const id = await parseId(params);
      if (id == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
      const search = request.nextUrl.searchParams;
      const ref = budgetQuincenaRefSchema.parse({
        year: search.get('year'),
        month: search.get('month'),
        period: search.get('period'),
      });
      const removed = await clearBudgetFortnightAdjustment(id, ownerFilter, ref);
      return NextResponse.json({ removed }, { status: 200 });
    });
  } catch (error) {
    return errorResponse(error, 'No se pudo quitar el ajuste');
  }
}
