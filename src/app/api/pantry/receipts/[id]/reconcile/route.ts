import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import { normalizePantryProductKey } from '@/lib/server/pantry/compute-pantry-insights';
import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';

const reconcileSchema = z.object({
  cart_id: z.number().int().positive().optional(),
  apply: z.boolean().optional(),
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
    const { id: rawId } = await params;
    const receiptId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(receiptId) || receiptId <= 0) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }
    const body = reconcileSchema.parse(await request.json().catch(() => ({})));
    const receipt = await prisma.pantryReceipt.findFirst({
      where: { id: receiptId, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
      include: { lines: true },
    });
    if (!receipt) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }
    const cartId = body.cart_id ?? receipt.linked_cart_id;
    if (!cartId) {
      return NextResponse.json({ error: 'No hay carrito para reconciliar' }, { status: 400 });
    }
    const cart = await prisma.pantryShoppingCart.findFirst({
      where: { id: cartId, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
      include: { items: true },
    });
    if (!cart) {
      return NextResponse.json({ error: 'Carrito no encontrado' }, { status: 404 });
    }

    const byName = new Map(
      cart.items.map((item) => [normalizePantryProductKey(item.name), item]),
    );
    const updates: Array<{ id: number; quantity: number; unit_price: number | null; checked: boolean }> = [];
    let matched = 0;
    let missing = 0;
    for (const line of receipt.lines) {
      const key = normalizePantryProductKey(line.description);
      const match = byName.get(key);
      if (!match) {
        missing += 1;
        continue;
      }
      matched += 1;
      updates.push({
        id: match.id,
        quantity: decimalToNumber(line.quantity) ?? 1,
        unit_price: decimalToNumber(line.unit_price),
        checked: true,
      });
    }

    if (body.apply) {
      await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          await tx.pantryShoppingCartItem.update({
            where: { id: update.id },
            data: {
              quantity: update.quantity,
              unit_price: update.unit_price,
              checked: update.checked,
              updated_by_user_id: userId,
            },
          });
        }
        await tx.pantryShoppingCart.update({
          where: { id: cart.id },
          data: { status: 'BOUGHT', updated_by_user_id: userId },
        });
      });
    }

    return NextResponse.json(
      {
        cart_id: cart.id,
        receipt_id: receipt.id,
        matched_count: matched,
        missing_count: missing,
        total_receipt_lines: receipt.lines.length,
        applied: body.apply === true,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('receipt reconcile POST', error);
    return NextResponse.json(
      { error: 'No se pudo reconciliar el recibo con el carrito' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
