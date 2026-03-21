import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createCreditCardPurchaseSchema } from '@/schemas/credit-card.schema';
import { createCreditCardPurchase } from '@/lib/finance/credit-card.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let purchaseLogContext: {
    owner_type: string;
    owner_id: number;
    credit_card_wallet_id: number;
    amount: number;
  } | null = null;

  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { id } = await params;
    const creditCardId = Number(id);

    if (!id || Number.isNaN(creditCardId)) {
      return NextResponse.json(
        { error: 'Se requiere un id válido' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validatedData = createCreditCardPurchaseSchema.parse(body);

    const [fortnight, category] = await Promise.all([
      prisma.fortnight.findFirst({
        where: { id: validatedData.fortnight_id, ...context.ownerFilter },
        select: { id: true },
      }),
      prisma.category.findFirst({
        where: { id: validatedData.category_id, ...context.ownerFilter },
        select: { id: true },
      }),
    ]);

    if (!fortnight) {
      return NextResponse.json({ error: 'Quincena no encontrada' }, { status: 404 });
    }

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    purchaseLogContext = {
      owner_type: context.ownerType,
      owner_id: context.ownerId,
      credit_card_wallet_id: creditCardId,
      amount: validatedData.amount,
    };

    const purchase = await createCreditCardPurchase(
      creditCardId,
      context.ownerFilter,
      validatedData,
    );

    logFinanceEvent(
      'info',
      'credit_card.purchase.created',
      {
        credit_card_wallet_id: creditCardId,
        expense_id: purchase.id,
        amount: Number(purchase.amount),
        owner_type: context.ownerType,
        owner_id: context.ownerId,
      },
      request,
    );

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'CREDIT_LIMIT_EXCEEDED' ||
        error.code === 'INSUFFICIENT_WALLET_BALANCE')
    ) {
      if (purchaseLogContext) {
        logFinanceEvent(
          'warn',
          'finance.api.client_error',
          {
            route: 'POST /api/credit-cards/[id]/purchase',
            error_code:
              error.code === 'CREDIT_LIMIT_EXCEEDED'
                ? 'CREDIT_LIMIT_EXCEEDED'
                : 'INSUFFICIENT_WALLET_BALANCE',
            ...purchaseLogContext,
          },
          request,
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Compra no válida',
        },
        { status: 400 },
      );
    }

    console.error('Error creating credit card purchase:', error);
    return NextResponse.json(
      { error: 'No se pudo registrar la compra' },
      { status: 500 },
    );
  }
}
