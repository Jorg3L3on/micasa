import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  deleteLoanForOwner,
  updateLoanForOwner,
} from '@/lib/finance/loan.service';
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
    if (message === 'Préstamo no encontrado') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Error updating loan:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
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

    const result = await deleteLoanForOwner(loanId, context.ownerFilter);

    return NextResponse.json(
      {
        message: 'Préstamo eliminado correctamente',
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al eliminar el préstamo';
    if (message === 'Préstamo no encontrado') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Error deleting loan:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
