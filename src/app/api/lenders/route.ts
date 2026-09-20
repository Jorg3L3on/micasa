import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  reportApiError,
  setOwnerSentryContext,
} from '@/lib/observability/report-error';
import {
  createLenderForOwner,
  listLendersByOwner,
} from '@/lib/finance/lender.service';
import { createLenderSchema } from '@/schemas/lender.schema';

export async function GET(request: NextRequest) {
  const route = 'GET /api/lenders';
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    setOwnerSentryContext({
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
    });

    const lenders = await listLendersByOwner(context.ownerFilter);
    return NextResponse.json(lenders, { status: 200 });
  } catch (error) {
    console.error('Error fetching lenders:', error);
    reportApiError(error, { route, status: 500 });
    return NextResponse.json(
      { error: 'Error al obtener los prestamistas' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const route = 'POST /api/lenders';
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
    setOwnerSentryContext(owner);

    const body = await request.json();
    const input = createLenderSchema.parse(body);
    const lender = await createLenderForOwner(
      context.ownerType,
      context.ownerId,
      context.ownerFilter,
      input,
    );

    return NextResponse.json(lender, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Error al crear el prestamista';
    console.error('Error creating lender:', error);
    reportApiError(error, { route, owner });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
