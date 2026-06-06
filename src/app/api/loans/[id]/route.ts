import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateLoanForOwner } from '@/lib/finance/loan.service';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { updateLoanSchema } from '@/schemas/loan.schema';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const loanId = Number(id);
    if (!Number.isInteger(loanId) || loanId <= 0) {
      return NextResponse.json(
        { error: 'El id del préstamo es inválido' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const input = updateLoanSchema.parse(body);
    const loan = await updateLoanForOwner(loanId, context.ownerFilter, input);

    return NextResponse.json(loan, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Error al actualizar el préstamo';
    console.error('Error updating loan:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
