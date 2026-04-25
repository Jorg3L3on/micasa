import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  ShoppingCartValidationError,
  removeShoppingCartItem,
  updateShoppingCartItem,
} from '@/lib/server/pantry/shopping-cart.service';
import { updateShoppingCartItemSchema } from '@/schemas/pantry-shopping-cart.schema';

type RouteParams = { params: Promise<{ id: string; itemId: string }> };

const parsePositiveInt = (raw: string): number | null => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

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

    const { id: idRaw, itemId: itemRaw } = await params;
    const cartId = parsePositiveInt(idRaw);
    const itemId = parsePositiveInt(itemRaw);
    if (cartId == null || itemId == null) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const data = updateShoppingCartItemSchema.parse(body);

    const item = await updateShoppingCartItem(
      { ownerType, ownerId },
      userId,
      cartId,
      itemId,
      data,
    );
    return NextResponse.json(item, { status: 200 });
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
    console.error('shopping-cart item PATCH', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar el ítem' },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { id: idRaw, itemId: itemRaw } = await params;
    const cartId = parsePositiveInt(idRaw);
    const itemId = parsePositiveInt(itemRaw);
    if (cartId == null || itemId == null) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await removeShoppingCartItem(
      { ownerType, ownerId },
      userId,
      cartId,
      itemId,
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('shopping-cart item DELETE', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar el ítem' },
      { status: 500 },
    );
  }
}
