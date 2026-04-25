import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  listShoppingCartActivity,
} from '@/lib/server/pantry/shopping-cart.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const { id: idRaw } = await params;
    const cartId = Number.parseInt(idRaw, 10);
    if (!Number.isFinite(cartId) || cartId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const limitRaw = request.nextUrl.searchParams.get('limit');
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 100;

    const activity = await listShoppingCartActivity(
      { ownerType, ownerId },
      cartId,
      Number.isFinite(limit) ? limit : 100,
    );
    return NextResponse.json(activity, { status: 200 });
  } catch (error) {
    if (error instanceof ShoppingCartNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('shopping-cart activity GET', error);
    return NextResponse.json(
      { error: 'No se pudo cargar la actividad' },
      { status: 500 },
    );
  }
}
