import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';

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
      select: {
        file_name: true,
        file_mime: true,
        file_data: true,
      },
    });

    if (!receipt?.file_data || receipt.file_data.length === 0) {
      return NextResponse.json(
        { error: 'No hay archivo guardado para este recibo' },
        { status: 404 },
      );
    }

    const safeName = (receipt.file_name ?? 'recibo').replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_');
    const mime = receipt.file_mime || 'application/octet-stream';

    return new NextResponse(Buffer.from(receipt.file_data), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
        'Cache-Control': 'private, max-age=0',
      },
    });
  } catch (error) {
    console.error('pantry receipt file GET', error);
    return NextResponse.json(
      { error: 'No se pudo descargar el archivo' },
      { status: 500 },
    );
  }
}
