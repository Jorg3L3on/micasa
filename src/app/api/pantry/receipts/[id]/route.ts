import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import {
  extractLinkedCartIdFromWarnings,
  withLinkedCartWarning,
} from '@/lib/server/pantry/pantry-receipt-links';
import { serializePantryReceiptDetail } from '@/lib/server/pantry/serialize-pantry-receipt';
import { syncPantryProductsFromReceiptLines } from '@/lib/server/pantry/sync-pantry-products-from-lines';
import { patchPantryReceiptSchema } from '@/schemas/pantry-receipt.schema';

const normalizeTextKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeUnitLabel = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = normalizeTextKey(value);
  if (normalized === 'pieza' || normalized === 'pza' || normalized === 'pz') {
    return 'pz';
  }
  if (normalized === 'kilogramo' || normalized === 'kilo') {
    return 'kg';
  }
  return normalized;
};

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const receipt = await prisma.pantryReceipt.findFirst({
      where: { id, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
      include: {
        lines: { orderBy: { sort_order: 'asc' } },
        linked_expense: {
          select: {
            id: true,
            description: true,
            amount: true,
            payment_date: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(serializePantryReceiptDetail(receipt), { status: 200 });
  } catch (error) {
    console.error('pantry receipt GET', error);
    return NextResponse.json(
      { error: 'No se pudo cargar el recibo' },
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
    const { ownerType, ownerId, ownerFilter } = context;
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.pantryReceipt.findFirst({
      where: { id, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const data = patchPantryReceiptSchema.parse(body);

    let purchasedAt: Date | null | undefined;
    if (data.purchased_at !== undefined) {
      if (data.purchased_at === null) {
        purchasedAt = null;
      } else {
        const d = new Date(data.purchased_at);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { error: 'Fecha de compra inválida' },
            { status: 400 },
          );
        }
        purchasedAt = d;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pantryReceipt.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(purchasedAt !== undefined ? { purchased_at: purchasedAt } : {}),
          ...(data.linked_cart_id !== undefined
            ? {
                parse_warnings: withLinkedCartWarning(
                  existing.parse_warnings,
                  data.linked_cart_id,
                ),
                linked_cart_id: data.linked_cart_id,
              }
            : {}),
        },
      });

      if (data.lines && data.lines.length > 0) {
        await tx.pantryReceiptLine.deleteMany({ where: { receipt_id: id } });
        await tx.pantryReceiptLine.createMany({
          data: data.lines.map((l, i) => ({
            receipt_id: id,
            sort_order: i,
            description: l.description,
            normalized_name: normalizeTextKey(l.description),
            quantity: l.quantity,
            unit_label: l.unit_label ?? null,
            normalized_unit: normalizeUnitLabel(l.unit_label ?? null),
            unit_price: l.unit_price ?? null,
            line_total: l.line_total,
          })),
        });
        await syncPantryProductsFromReceiptLines({
          ownerType,
          ownerId,
          ownerFilter,
          lines: data.lines.map((l) => ({
            description: l.description,
            unit_label: l.unit_label ?? null,
            unit_price: l.unit_price ?? null,
          })),
          db: tx,
        });
      }
    });

    const updated = await prisma.pantryReceipt.findFirstOrThrow({
      where: { id },
      include: {
        lines: { orderBy: { sort_order: 'asc' } },
        linked_expense: {
          select: {
            id: true,
            description: true,
            amount: true,
            payment_date: true,
          },
        },
      },
    });

    return NextResponse.json(serializePantryReceiptDetail(updated), { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('pantry receipt PATCH', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar el recibo' },
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
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.pantryReceipt.findFirst({
      where: { id, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.pantryReceipt.delete({ where: { id } });

      const linkedCartId =
        existing.linked_cart_id ??
        extractLinkedCartIdFromWarnings(existing.parse_warnings);
      if (linkedCartId == null) return;

      await tx.pantryShoppingCart.deleteMany({
        where: {
          id: linkedCartId,
          ...pantryReceiptOwnerWhere(ownerType, ownerId),
        },
      });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('pantry receipt DELETE', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar el recibo' },
      { status: 500 },
    );
  }
}
