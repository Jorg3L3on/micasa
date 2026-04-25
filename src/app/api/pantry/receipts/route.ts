import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import {
  parsePantryReceiptUpload,
  PANTRY_RECEIPT_MAX_FILE_BYTES,
} from '@/lib/server/pantry/parse-receipt-upload';
import {
  decimalToNumber,
  serializePantryReceiptDetail,
} from '@/lib/server/pantry/serialize-pantry-receipt';
import { syncPantryProductsFromReceiptLines } from '@/lib/server/pantry/sync-pantry-products-from-lines';
import type { PantryReceiptListItemDto } from '@/types/pantry-receipt';

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
        currency: r.currency,
        purchased_at: r.purchased_at?.toISOString() ?? null,
        grand_total: decimalToNumber(r.grand_total),
        line_count: r.lines.length,
        lines_sum: Math.round(linesSum * 100) / 100,
        file_name: r.file_name,
        parse_warnings: r.parse_warnings,
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
    if (purchasedOverride && Number.isNaN(purchasedOverride.getTime())) {
      return NextResponse.json(
        { error: 'Fecha de compra inválida' },
        { status: 400 },
      );
    }

    const parsed = await parsePantryReceiptUpload({
      buffer: buf,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name || 'upload',
    });

    const defaultTitle = file.name.replace(/\.[^.]+$/, '') || 'Recibo';
    const title = titleOverride ?? parsed.title ?? defaultTitle;

    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.pantryReceipt.create({
        data: {
          title,
          merchant_ref: parsed.merchant_ref,
          purchased_at: purchasedOverride ?? parsed.purchased_at,
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
          parse_warnings: parsed.warnings,
          lines: {
            create: parsed.lines.map((l, i) => ({
              sort_order: i,
              description: l.description,
              quantity: l.quantity,
              unit_label: l.unit_label,
              unit_price: l.unit_price,
              line_total: l.line_total,
            })),
          },
        },
      });

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
