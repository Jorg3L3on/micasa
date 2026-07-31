import { parseCalendarDate } from '@/lib/calendar-dates';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { createExpense } from '@/lib/finance/expense.service';
import { parseWalletImportCsv } from '@/lib/finance/parse-wallet-import-csv';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';
import type { WalletImportResult } from '@/types/wallet-movements';

const bodySchema = z.object({
  csv: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter, ownerType, ownerId } = context;

    const { id } = await params;
    const walletId = Number(id);
    if (!Number.isFinite(walletId) || walletId <= 0) {
      return NextResponse.json(
        { error: 'Invalid wallet id' },
        { status: 400 },
      );
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter },
    });
    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 },
      );
    }
    if (wallet.type !== 'CASH' && wallet.type !== 'DEBIT_CARD') {
      return NextResponse.json(
        {
          error:
            'La importación CSV solo aplica a efectivo y tarjetas de débito.',
        },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { csv } = bodySchema.parse(body);

    const { rows, issues: parseIssues } = parseWalletImportCsv(csv);
    const rowIssues: { line: number; message: string }[] = [...parseIssues];
    let imported = 0;
    if (parseIssues.length > 0 && rows.length === 0) {
      return NextResponse.json(
        {
          imported: 0,
          skipped: parseIssues.length,
          errors: parseIssues,
        } satisfies WalletImportResult,
        { status: 200 },
      );
    }

    const categories = await prisma.category.findMany({
      where: { ...ownerFilter },
      select: { id: true, name: true },
    });
    const categoryByName = new Map<string, number>();
    for (const c of categories) {
      categoryByName.set(c.name.toLowerCase(), c.id);
    }

    for (const row of rows) {
      const [yearStr, monthStr, dayStr] = row.date.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      const period = getFortnightPeriodForDay(day);
      try {
        const fortnight = await resolveOrCreateFortnight({
          ownerType,
          ownerId,
          year,
          month,
          period,
        });
        if (row.type === 'expense') {
          const categoryId =
            categoryByName.get(row.category.toLowerCase()) ?? null;
          if (categoryId == null) {
            rowIssues.push({
              line: row.line,
              message: `Categoría "${row.category}" no encontrada`,
            });
            continue;
          }
          await createExpense({
            fortnightId: fortnight.id,
            categoryId,
            description: row.description,
            amount: row.amount,
            isPaid: true,
            paymentDate: row.date,
            expenseTemplateId: null,
            walletId,
          });
        } else {
          const ownerData =
            ownerType === 'user'
              ? { user_id: ownerId, house_id: null }
              : { user_id: null, house_id: ownerId };
          await prisma.$transaction(async (tx) => {
            await tx.income.create({
              data: {
                fortnight_id: fortnight.id,
                amount: row.amount,
                source: row.description,
                received_at: parseCalendarDate(row.date),
                wallet_id: walletId,
                ...ownerData,
              },
            });
            await applyWalletAmountDelta(tx, walletId, row.amount);
          });
        }
        imported++;
      } catch (err) {
        rowIssues.push({
          line: row.line,
          message: err instanceof Error ? err.message : 'Error al importar',
        });
      }
    }

    const result: WalletImportResult = {
      imported,
      skipped: rowIssues.length,
      errors: rowIssues,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error importing wallet CSV:', error);
    return NextResponse.json(
      { error: 'Failed to import wallet CSV' },
      { status: 500 },
    );
  }
}
