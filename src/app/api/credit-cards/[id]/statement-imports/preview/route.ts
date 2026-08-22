import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { StatementImportProvider } from '@/generated/prisma/client';
import { previewStatementPdf } from '@/lib/server/credit-card-statement/statement-import.service';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const walletId = Number(id);
    if (!id || Number.isNaN(walletId)) {
      return NextResponse.json({ error: 'Se requiere un id válido' }, { status: 400 });
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
    if (buf.length > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Archivo demasiado grande' }, { status: 413 });
    }

    const providerRaw = String(formData.get('provider') ?? '').toUpperCase();
    const validProviders: string[] = Object.values(StatementImportProvider);
    if (!providerRaw || !validProviders.includes(providerRaw)) {
      return NextResponse.json({ error: 'Proveedor no válido' }, { status: 400 });
    }

    const preview = await previewStatementPdf(
      providerRaw as StatementImportProvider,
      buf,
    );

    return NextResponse.json(preview, { status: 200 });
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : undefined;

    if (code === 'UNREADABLE_PDF') {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'PDF ilegible' },
        { status: 422 },
      );
    }

    console.error('statement-import preview', error);
    return NextResponse.json(
      { error: 'No se pudo analizar el estado de cuenta' },
      { status: 500 },
    );
  }
}
