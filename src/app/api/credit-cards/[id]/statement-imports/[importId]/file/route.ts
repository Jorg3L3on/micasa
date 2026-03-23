import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const creditCardWalletTypes = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; importId: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id, importId } = await params;
    const walletId = Number(id);
    const impId = Number(importId);
    if (!id || Number.isNaN(walletId) || !importId || Number.isNaN(impId)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const card = await prisma.wallet.findFirst({
      where: {
        id: walletId,
        ...context.ownerFilter,
        type: { in: [...creditCardWalletTypes] },
      },
      select: { id: true },
    });
    if (!card) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    const row = await prisma.creditCardStatementImport.findFirst({
      where: { id: impId, wallet_id: walletId },
      select: { file_data: true, file_mime: true, file_name: true },
    });

    if (!row?.file_data || row.file_data.length === 0) {
      return NextResponse.json(
        { error: 'No hay archivo guardado para esta importación' },
        { status: 404 },
      );
    }

    const mime = row.file_mime || 'application/pdf';
    const downloadName = row.file_name?.replace(/[^\w.\-()\s]/g, '_') || 'estado-cuenta.pdf';

    return new NextResponse(Buffer.from(row.file_data), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('statement-import file GET', error);
    return NextResponse.json(
      { error: 'No se pudo descargar el archivo' },
      { status: 500 },
    );
  }
}
