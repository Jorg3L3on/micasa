import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  ShoppingCartNotFoundError,
  ShoppingCartValidationError,
  addShoppingCartItemsBulk,
} from '@/lib/server/pantry/shopping-cart.service';

const bulkItemSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().positive().max(999_999).optional(),
  unit_label: z.string().max(32).nullable().optional(),
  unit_price: z.number().min(0).max(9_999_999.99).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const bulkCreateSchema = z.object({
  items: z.array(bulkItemSchema).min(1).max(500),
  checked: z.boolean().optional(),
});

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
    const data = bulkCreateSchema.parse(body);
    const result = await addShoppingCartItemsBulk(
      { ownerType, ownerId },
      userId,
      cartId,
      data.items,
      { checked: data.checked },
    );
    return NextResponse.json(result, { status: 201 });
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
    console.error('shopping-cart items bulk POST', error);
    return NextResponse.json(
      { error: 'No se pudieron agregar los ítems' },
      { status: 500 },
    );
  }
}
