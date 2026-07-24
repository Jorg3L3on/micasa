import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { captureOwnerError } from '@/lib/observability/sentry';
import prisma from '@/lib/prisma';
import { rollbackCreditCardStatementImport } from '@/lib/server/credit-card-statement/rollback-statement-import.service';

export const runtime = 'nodejs';

const creditCardWalletTypes = ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; importId: string }> },
) {
  let ownerForErrors: {
    userId?: number;
    ownerType?: string;
    ownerId?: number;
  } = {};

  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    ownerForErrors = {
      userId: context.userId,
      ownerType: context.ownerType,
      ownerId: context.ownerId,
    };

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

    const result = await rollbackCreditCardStatementImport({
      creditCardWalletId: walletId,
      importId: impId,
      ownerFilter: context.ownerFilter,
    });

    return NextResponse.json(
      {
        expenses_removed: result.expensesRemoved,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'IMPORT_NOT_FOUND'
    ) {
      return NextResponse.json(
        { error: 'Importación no encontrada' },
        { status: 404 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code: string }).code === 'EXPENSE_TRANSFER_LOCKED' ||
        (error as { code: string }).code === 'EXPENSE_PAYMENT_LINKED' ||
        (error as { code: string }).code === 'EXPENSE_WALLET_MISMATCH')
    ) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'No se puede revertir' },
        { status: 409 },
      );
    }

    console.error('statement-import DELETE', error);
    captureOwnerError(error, {
      userId: ownerForErrors.userId,
      ownerType: ownerForErrors.ownerType,
      ownerId: ownerForErrors.ownerId,
      feature: 'statement-import',
      tags: { statement_import_op: 'rollback' },
    });
    return NextResponse.json(
      { error: 'No se pudo revertir la importación' },
      { status: 500 },
    );
  }
}
