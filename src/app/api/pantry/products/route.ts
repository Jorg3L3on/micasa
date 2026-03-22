import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import { serializePantryProduct } from '@/lib/server/pantry/serialize-pantry-product';
import { createPantryProductSchema } from '@/schemas/pantry-product.schema';
import type { PantryProductDto } from '@/types/pantry-product';

const normalizeOptionalString = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const rows = await prisma.pantryProduct.findMany({
      where: pantryReceiptOwnerWhere(ownerType, ownerId),
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    const payload: PantryProductDto[] = rows.map(serializePantryProduct);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('pantry products GET', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los productos' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId, ownerFilter } = context;

    const body = await request.json();
    const data = createPantryProductSchema.parse(body);
    const name = data.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const duplicate = await prisma.pantryProduct.findFirst({
      where: {
        ...pantryReceiptOwnerWhere(ownerType, ownerId),
        name,
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Ya existe un producto con este nombre' },
        { status: 409 },
      );
    }

    const inserted = await prisma.pantryProduct.create({
      data: {
        name,
        description: normalizeOptionalString(data.description ?? undefined),
        barcode: normalizeOptionalString(data.barcode ?? undefined),
        brand: normalizeOptionalString(data.brand ?? undefined),
        unit_label: normalizeOptionalString(data.unit_label ?? undefined),
        default_unit_price:
          data.default_unit_price === undefined || data.default_unit_price === null
            ? null
            : data.default_unit_price,
        active: data.active,
        user_id: ownerFilter.user_id,
        house_id: ownerFilter.house_id,
      },
    });

    const created = await prisma.pantryProduct.findFirstOrThrow({
      where: { id: inserted.id },
    });

    return NextResponse.json(serializePantryProduct(created), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('pantry products POST', error);
    return NextResponse.json(
      { error: 'No se pudo crear el producto' },
      { status: 500 },
    );
  }
}
