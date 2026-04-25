import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  ShoppingCartValidationError,
  addShoppingCartItem,
} from '@/lib/server/pantry/shopping-cart.service';
import { createShoppingCartItemSchema } from '@/schemas/pantry-shopping-cart.schema';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
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
    const data = createShoppingCartItemSchema.parse(body);

    const item = await addShoppingCartItem(
      { ownerType, ownerId },
      userId,
      cartId,
      data,
    );
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ShoppingCartValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('shopping-cart item POST', error);
    return NextResponse.json(
      { error: 'No se pudo agregar el ítem' },
      { status: 500 },
    );
  }
}
