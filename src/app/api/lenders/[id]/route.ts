import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { reportApiError } from '@/lib/observability/report-error';
import { getLenderByIdForOwner } from '@/lib/finance/lender.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = 'GET /api/lenders/[id]';
  let owner:
    | { userId: number; ownerType: 'user' | 'house'; ownerId: number }
    | undefined;
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    owner = {
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
    };

    const { id } = await params;
    const lenderId = Number(id);
    if (!Number.isInteger(lenderId) || lenderId <= 0) {
      return NextResponse.json(
        { error: 'El id del prestamista es inválido' },
        { status: 400 },
      );
    }

    const lender = await getLenderByIdForOwner(
      lenderId,
      context.ownerFilter,
    );
    return NextResponse.json(lender, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Error al obtener el prestamista';
    if (message === 'Prestamista no encontrado') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error('Error fetching lender:', error);
    reportApiError(error, { route, status: 500, owner });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
