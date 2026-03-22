import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import { serializePantryProduct } from '@/lib/server/pantry/serialize-pantry-product';
import { patchPantryProductSchema } from '@/schemas/pantry-product.schema';

const trimToNull = (value: string | null): string | null => {
  if (value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
};

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(
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

    const existing = await prisma.pantryProduct.findFirst({
      where: { id, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const data = patchPantryProductSchema.parse(body);

    const nextName = data.name !== undefined ? data.name.trim() : undefined;
    if (nextName !== undefined && !nextName) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    if (nextName && nextName !== existing.name) {
      const duplicate = await prisma.pantryProduct.findFirst({
        where: {
          ...pantryReceiptOwnerWhere(ownerType, ownerId),
          name: nextName,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un producto con este nombre' },
          { status: 409 },
        );
      }
    }

    const updateData: {
      name?: string;
      description?: string | null;
      barcode?: string | null;
      brand?: string | null;
      unit_label?: string | null;
      default_unit_price?: number | null;
      active?: boolean;
    } = {};

    if (nextName !== undefined) updateData.name = nextName;
    if (data.description !== undefined) {
      updateData.description = trimToNull(data.description);
    }
    if (data.barcode !== undefined) {
      updateData.barcode = trimToNull(data.barcode);
    }
    if (data.brand !== undefined) {
      updateData.brand = trimToNull(data.brand);
    }
    if (data.unit_label !== undefined) {
      updateData.unit_label = trimToNull(data.unit_label);
    }
    if (data.default_unit_price !== undefined) {
      updateData.default_unit_price = data.default_unit_price;
    }
    if (data.active !== undefined) {
      updateData.active = data.active;
    }

    const updated = await prisma.pantryProduct.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(serializePantryProduct(updated), { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('pantry product PATCH', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar el producto' },
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

    const existing = await prisma.pantryProduct.findFirst({
      where: { id, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    await prisma.pantryProduct.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('pantry product DELETE', error);
    return NextResponse.json(
      { error: 'No se pudo eliminar el producto' },
      { status: 500 },
    );
  }
}
