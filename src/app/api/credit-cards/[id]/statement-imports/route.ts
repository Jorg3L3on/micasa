import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import prisma from '@/lib/prisma';
import { StatementImportProvider } from '@/generated/prisma/client';
import { importStatementPdf } from '@/lib/server/credit-card-statement/statement-import.service';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const creditCardWalletTypes = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;

/** Thrown by `importStatementPdf` when `code === 'NO_MOVEMENTS'`. */
type NoMovementsStatementImportError = Error & {
  code: 'NO_MOVEMENTS';
  parse_warnings?: string[];
  statement_import_provider?: StatementImportProvider;
};

export async function GET(
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

    const rows = await prisma.creditCardStatementImport.findMany({
      where: { wallet_id: walletId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        provider: true,
        created_at: true,
        period_start: true,
        period_end: true,
        account_number: true,
        statement_issue_date: true,
        payment_due_date: true,
        total_due: true,
        minimum_payment: true,
        file_name: true,
        parse_warnings: true,
        _count: { select: { expenses: true } },
      },
    });

    const payload = rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      created_at: r.created_at.toISOString(),
      period_start: r.period_start?.toISOString() ?? null,
      period_end: r.period_end?.toISOString() ?? null,
      account_number: r.account_number,
      statement_issue_date: r.statement_issue_date?.toISOString() ?? null,
      payment_due_date: r.payment_due_date?.toISOString() ?? null,
      total_due: r.total_due != null ? Number(r.total_due) : null,
      minimum_payment: r.minimum_payment != null ? Number(r.minimum_payment) : null,
      file_name: r.file_name,
      has_file: r.file_name != null,
      expense_count: r._count.expenses,
      parse_warnings: r.parse_warnings,
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('statement-imports GET', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las importaciones' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const session = await auth();
    const createdBy = session?.user?.id ? Number(session.user.id) : NaN;
    if (Number.isNaN(createdBy)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      request,
      'mutation:statement-import',
      createdBy,
    );
    if (limited) return limited;

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
      return NextResponse.json(
        {
          error: `El archivo supera ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB`,
        },
        { status: 413 },
      );
    }

    const providerRaw = String(formData.get('provider') ?? '').toUpperCase();
    const validProviders: string[] = Object.values(StatementImportProvider);
    if (!providerRaw || !validProviders.includes(providerRaw)) {
      return NextResponse.json(
        {
          error: `Proveedor no válido. Opciones: ${validProviders.join(', ')}`,
        },
        { status: 400 },
      );
    }
    const provider = providerRaw as StatementImportProvider;

    const storeFile = formData.get('store_file') !== 'false';
    const skipDuplicates = formData.get('skip_duplicates') === 'true';
    const categoryField = formData.get('category_id');
    let categoryId: number | null = null;
    if (typeof categoryField === 'string' && categoryField.trim()) {
      const n = Number(categoryField);
      if (!Number.isNaN(n)) {
        categoryId = n;
      }
    }

    const result = await importStatementPdf(provider, {
      buffer: buf,
      fileName: file.name || 'estado-cuenta.pdf',
      mimeType: file.type || 'application/pdf',
      storeFile,
      creditCardWalletId: walletId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
      ownerFilter: context.ownerFilter,
      categoryId,
      skipDuplicates,
      createdByUserId: createdBy,
    });

    return NextResponse.json(
      {
        import_id: result.importId,
        expenses_created: result.expensesCreated,
        duplicates_skipped: result.duplicatesSkipped,
        lines_skipped: result.linesSkipped,
        warnings: result.warnings,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'NO_MOVEMENTS'
    ) {
      const noMov = error as unknown as NoMovementsStatementImportError;
      const parseWarnings = noMov.parse_warnings ?? [];
      const importProvider = noMov.statement_import_provider;
      let hint: string | undefined;
      if (importProvider === StatementImportProvider.MERCADO_PAGO) {
        hint =
          'Si el PDF es de DiDi Card, elige «DiDi Card» en Banco / Proveedor (el valor por defecto es Mercado Pago).';
      } else if (importProvider === StatementImportProvider.DIDI_CARD) {
        hint =
          'Confirma que es un PDF de DiDi Card con texto seleccionable (no solo escaneo) y que el archivo no esté dañado.';
      } else if (importProvider === StatementImportProvider.LIVERPOOL) {
        hint =
          'Este periodo puede no tener compras (solo pagos). Liverpool solo importa cargos positivos del detalle de movimientos.';
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'No hay movimientos importables',
          parse_warnings: parseWarnings,
          hint,
        },
        { status: 422 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'CARD_NOT_FOUND'
    ) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as Error).message === 'string' &&
      (error as Error).message.includes('crédito disponible')
    ) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 },
      );
    }

    console.error('statement-imports POST', error);
    return NextResponse.json(
      { error: 'No se pudo importar el estado de cuenta' },
      { status: 500 },
    );
  }
}
