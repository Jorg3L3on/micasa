import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  createShoppingCart,
  listShoppingCarts,
} from '@/lib/server/pantry/shopping-cart.service';
import {
  createShoppingCartSchema,
  shoppingCartStatusSchema,
} from '@/schemas/pantry-shopping-cart.schema';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const statusParam = request.nextUrl.searchParams.get('status');
    const parsedStatus =
      statusParam && statusParam !== 'ALL'
        ? shoppingCartStatusSchema.safeParse(statusParam)
        : null;
    const status = parsedStatus?.success ? parsedStatus.data : null;

    const carts = await listShoppingCarts({ ownerType, ownerId }, { status });
    return NextResponse.json(carts, { status: 200 });
  } catch (error) {
    console.error('shopping-carts GET', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los carritos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const data = createShoppingCartSchema.parse(body);

    const cart = await createShoppingCart(
      { ownerType, ownerId },
      userId,
      data,
    );
    return NextResponse.json(cart, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('shopping-carts POST', error);
    return NextResponse.json(
      { error: 'No se pudo crear el carrito' },
      { status: 500 },
    );
  }
}
