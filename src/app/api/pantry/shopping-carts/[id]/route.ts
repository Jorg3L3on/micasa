import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  deleteShoppingCart,
  getShoppingCartDetail,
  updateShoppingCart,
} from '@/lib/server/pantry/shopping-cart.service';
import { updateShoppingCartSchema } from '@/schemas/pantry-shopping-cart.schema';

type RouteParams = { params: Promise<{ id: string }> };

const parseId = (raw: string): number | null => {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const requireUserId = async (): Promise<number | null> => {
  const session = await auth();
  const userId = Number(session?.user?.id);
  return Number.isFinite(userId) ? userId : null;
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;
    const { id: idRaw } = await params;
    const cartId = parseId(idRaw);
    if (cartId == null) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const cart = await getShoppingCartDetail({ ownerType, ownerId }, cartId);
    return NextResponse.json(cart, { status: 200 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('shopping-cart GET', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el carrito' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;
    const userId = await requireUserId();
    if (userId == null) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id: idRaw } = await params;
    const cartId = parseId(idRaw);
    if (cartId == null) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const data = updateShoppingCartSchema.parse(body);

    const cart = await updateShoppingCart(
      { ownerType, ownerId },
      userId,
      cartId,
      data,
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
    console.error('shopping-cart PATCH', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar el carrito' },
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
    const userId = await requireUserId();
    if (userId == null) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id: idRaw } = await params;
    const cartId = parseId(idRaw);
    if (cartId == null) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    await deleteShoppingCart({ ownerType, ownerId }, userId, cartId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('shopping-cart DELETE', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar el carrito' },
      { status: 500 },
    );
  }
}
