import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import {
  parsePantryReceiptUpload,
  PANTRY_RECEIPT_MAX_FILE_BYTES,
} from '@/lib/server/pantry/parse-receipt-upload';
import { withLinkedCartWarning } from '@/lib/server/pantry/pantry-receipt-links';
import {
  decimalToNumber,
  serializePantryReceiptDetail,
} from '@/lib/server/pantry/serialize-pantry-receipt';
import { stripReceiptSystemWarnings } from '@/lib/server/pantry/pantry-receipt-links';
import { syncPantryProductsFromReceiptLines } from '@/lib/server/pantry/sync-pantry-products-from-lines';
import { shoppingStoreSchema } from '@/schemas/pantry-shopping-cart.schema';
import type { PantryReceiptListItemDto } from '@/types/pantry-receipt';

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId } = context;

    const rows = await prisma.pantryReceipt.findMany({
      where: pantryReceiptOwnerWhere(ownerType, ownerId),
      orderBy: { created_at: 'desc' },
      include: {
        lines: { select: { line_total: true } },
      },
    });

    const payload: PantryReceiptListItemDto[] = rows.map((r) => {
      const linesSum = r.lines.reduce(
        (acc, l) => acc + (decimalToNumber(l.line_total) ?? 0),
        0,
      );
      return {
        id: r.id,
        title: r.title,
        store: r.store,
        currency: r.currency,
        purchased_at: r.purchased_at?.toISOString() ?? null,
        grand_total: decimalToNumber(r.grand_total),
        line_count: r.lines.length,
        lines_sum: Math.round(linesSum * 100) / 100,
        file_name: r.file_name,
        parse_warnings: stripReceiptSystemWarnings(r.parse_warnings),
        created_at: r.created_at.toISOString(),
        created_by_user_id: r.created_by_user_id,
      };
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('pantry receipts GET', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los recibos' },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter, ownerType, ownerId } = context;

    const session = await auth();
    const createdBy = session?.user?.id ? Number(session.user.id) : NaN;
    if (Number.isNaN(createdBy)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Se espera multipart/form-data con el archivo en "file"' },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Falta el archivo (campo "file")' },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > PANTRY_RECEIPT_MAX_FILE_BYTES) {
      return NextResponse.json(
        {
          error: `El archivo supera ${Math.floor(PANTRY_RECEIPT_MAX_FILE_BYTES / (1024 * 1024))} MB`,
        },
        { status: 413 },
      );
    }

    const storeFile = formData.get('storeFile') !== 'false';
    const titleField = formData.get('title');
    const titleOverride =
      typeof titleField === 'string' && titleField.trim()
        ? titleField.trim()
        : null;
    const purchasedField = formData.get('purchased_at');
    const purchasedOverride =
      typeof purchasedField === 'string' && purchasedField.trim()
        ? new Date(purchasedField.trim())
        : null;
    if (!purchasedOverride) {
      return NextResponse.json(
        { error: 'La fecha de compra es obligatoria' },
        { status: 400 },
      );
    }
    if (purchasedOverride && Number.isNaN(purchasedOverride.getTime())) {
      return NextResponse.json(
        { error: 'Fecha de compra inválida' },
        { status: 400 },
      );
    }
    const storeField = formData.get('store');
    const storeRaw =
      typeof storeField === 'string' && storeField.trim()
        ? storeField.trim()
        : null;
    const parsedStore = storeRaw
      ? shoppingStoreSchema.safeParse(storeRaw)
      : null;
    if (storeRaw && !parsedStore?.success) {
      return NextResponse.json(
        { error: 'Tienda inválida' },
        { status: 400 },
      );
    }
    const cartModeField = formData.get('cartMode');
    const cartMode =
      cartModeField === 'new' || cartModeField === 'none'
        ? cartModeField
        : 'none';
    const newCartTitleField = formData.get('newCartTitle');
    const newCartTitle =
      typeof newCartTitleField === 'string' && newCartTitleField.trim().length > 0
        ? newCartTitleField.trim()
        : null;

    const parsed = await parsePantryReceiptUpload({
      buffer: buf,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name || 'upload',
    });

    const defaultTitle = file.name.replace(/\.[^.]+$/, '') || 'Recibo';
    const title = titleOverride ?? parsed.title ?? defaultTitle;

    const receipt = await prisma.$transaction(async (tx) => {
      let linkedCartId: number | null = null;
      const created = await tx.pantryReceipt.create({
        data: {
          title,
          merchant_ref: parsed.merchant_ref,
          purchased_at: purchasedOverride,
          store: parsedStore?.success ? parsedStore.data : null,
          subtotal: parsed.subtotal,
          discount_total: parsed.discount_total,
          delivery_fee: parsed.delivery_fee,
          grand_total: parsed.grand_total,
          currency: 'MXN',
          user_id: ownerFilter.user_id,
          house_id: ownerFilter.house_id,
          created_by_user_id: createdBy,
          file_name: storeFile ? file.name : null,
          file_mime: storeFile ? file.type || null : null,
          file_data: storeFile ? buf : null,
          parse_warnings: withLinkedCartWarning(parsed.warnings, null),
          source_type: (file.name.split('.').pop() ?? '').toUpperCase() || null,
          lines: {
            create: parsed.lines.map((l, i) => ({
              sort_order: i,
              description: l.description,
              normalized_name: normalizeTextKey(l.description),
              quantity: l.quantity,
              unit_label: l.unit_label,
              normalized_unit: normalizeUnitLabel(l.unit_label),
              unit_price: l.unit_price,
              line_total: l.line_total,
            })),
          },
        },
      });

      if (cartMode === 'new') {
        const fallbackDate = purchasedOverride.toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const cartTitle = newCartTitle ?? title ?? `Compra ${fallbackDate}`;
        const cart = await tx.pantryShoppingCart.create({
          data: {
            title: cartTitle,
            notes: null,
            status: 'BOUGHT',
            currency: 'MXN',
            store: parsedStore?.success ? parsedStore.data : null,
            user_id: ownerFilter.user_id,
            house_id: ownerFilter.house_id,
            created_by_user_id: createdBy,
            updated_by_user_id: createdBy,
          },
        });
        linkedCartId = cart.id;

        const linesForCart = parsed.lines
          .map((line, index) => ({
            cart_id: cart.id,
            product_id: null,
            name: line.description.trim(),
            quantity: line.quantity > 0 ? line.quantity : 1,
            unit_label: line.unit_label,
            unit_price: line.unit_price,
            notes: null,
            checked: true,
            sort_order: index,
            created_by_user_id: createdBy,
            updated_by_user_id: createdBy,
          }))
          .filter((line) => line.name.length > 0);
        if (linesForCart.length > 0) {
          await tx.pantryShoppingCartItem.createMany({ data: linesForCart });
          await tx.pantryShoppingCartActivity.create({
            data: {
              cart_id: cart.id,
              user_id: createdBy,
              action: 'ITEM_ADDED',
              metadata: {
                bulk: true,
                created_count: linesForCart.length,
                checked: true,
              },
            },
          });
        }
        await tx.pantryShoppingCartActivity.create({
          data: {
            cart_id: cart.id,
            user_id: createdBy,
            action: 'CART_CREATED',
            metadata: { title: cart.title, store: cart.store },
          },
        });
      }

      if (linkedCartId != null) {
        await tx.pantryReceipt.update({
          where: { id: created.id },
          data: {
            parse_warnings: withLinkedCartWarning(parsed.warnings, linkedCartId),
            linked_cart_id: linkedCartId,
          },
        });
      }

      await syncPantryProductsFromReceiptLines({
        ownerType,
        ownerId,
        ownerFilter,
        lines: parsed.lines.map((l) => ({
          description: l.description,
          unit_label: l.unit_label,
          unit_price: l.unit_price,
        })),
        db: tx,
      });

      return tx.pantryReceipt.findFirstOrThrow({
        where: { id: created.id },
        include: { lines: { orderBy: { sort_order: 'asc' } } },
      });
    }, { timeout: 30000, maxWait: 10000 });

    return NextResponse.json(serializePantryReceiptDetail(receipt), {
      status: 201,
    });
  } catch (error) {
    console.error('pantry receipts POST', error);
    return NextResponse.json(
      { error: 'No se pudo guardar el recibo' },
      { status: 500 },
    );
  }
}
