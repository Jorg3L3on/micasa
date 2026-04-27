import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  checkAllShoppingCartItems,
} from '@/lib/server/pantry/shopping-cart.service';

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

    const result = await checkAllShoppingCartItems({ ownerType, ownerId }, userId, cartId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('shopping-cart items check-all PATCH', error);
    return NextResponse.json(
      { error: 'No se pudieron marcar los ítems' },
      { status: 500 },
    );
  }
}
