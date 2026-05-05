import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import {
  buildPantryReceiptExpenseDescription,
  linkExpenseToPantryReceiptInTransaction,
  resolveParsedReceiptExpenseAmount,
  responseForPantryExpenseRegistrationError,
} from '@/lib/server/pantry/pantry-receipt-expense';
import { serializePantryReceiptDetail } from '@/lib/server/pantry/serialize-pantry-receipt';
import { registerPantryReceiptExpenseBodySchema } from '@/schemas/pantry-receipt-expense.schema';
import { SHOPPING_STORE_LABELS } from '@/types/shopping-store';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerType, ownerId, ownerFilter } = context;

    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const data = registerPantryReceiptExpenseBodySchema.parse(body);

    const existing = await prisma.pantryReceipt.findFirst({
      where: { id, ...pantryReceiptOwnerWhere(ownerType, ownerId) },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
    }
    if (existing.linked_expense_id != null) {
      return NextResponse.json(
        { error: 'Este recibo ya tiene un gasto vinculado' },
        { status: 409 },
      );
    }

    const parsedLines = await prisma.pantryReceiptLine.findMany({
      where: { receipt_id: id },
      select: { line_total: true },
      orderBy: { sort_order: 'asc' },
    });

    const amount = resolveParsedReceiptExpenseAmount({
      grand_total: existing.grand_total,
      lines: parsedLines.map((l) => ({ line_total: l.line_total })),
    });
    if (amount == null) {
      return NextResponse.json(
        {
          error:
            'No hay total válido para registrar el gasto (revisa el total o las líneas del recibo)',
        },
        { status: 400 },
      );
    }

    const storeLabel =
      existing.store != null ? SHOPPING_STORE_LABELS[existing.store] : null;
    const description = buildPantryReceiptExpenseDescription(
      existing.title,
      storeLabel,
    );

    const updated = await prisma.$transaction(async (tx) => {
      await linkExpenseToPantryReceiptInTransaction(tx, {
        ownerType,
        ownerId,
        ownerFilter,
        receiptId: id,
        categoryId: data.categoryId,
        walletId: data.walletId,
        expenseDateYmd: data.date,
        amount,
        description,
      });
      return tx.pantryReceipt.findFirstOrThrow({
        where: { id },
        include: {
          lines: { orderBy: { sort_order: 'asc' } },
          linked_expense: {
            select: {
              id: true,
              description: true,
              amount: true,
              payment_date: true,
            },
          },
        },
      });
    });

    return NextResponse.json(serializePantryReceiptDetail(updated), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    const mapped = responseForPantryExpenseRegistrationError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    console.error('pantry receipt POST expense', error);
    return NextResponse.json(
      { error: 'No se pudo registrar el gasto' },
      { status: 500 },
    );
  }
}
