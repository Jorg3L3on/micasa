import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  updateShoppingCartStatus,
} from '@/lib/server/pantry/shopping-cart.service';
import { updateShoppingCartStatusSchema } from '@/schemas/pantry-shopping-cart.schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: idRaw } = await params;
    const cartId = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(cartId) || cartId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = updateShoppingCartStatusSchema.parse(body);

    const cart = await updateShoppingCartStatus(
      { ownerType, ownerId },
      userId,
      cartId,
      status,
    );
    return NextResponse.json(cart, { status: 200 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('shopping-cart status PATCH', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar el estado' },
      { status: 500 },
    );
  }
}
