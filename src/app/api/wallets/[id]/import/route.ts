import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import {
  resolveOrCreateFortnight,
  getFortnightPeriodForDay,
} from '@/lib/fortnights';
import { createExpense } from '@/lib/finance/expense.service';
import { applyWalletAmountDelta } from '@/lib/finance/wallet-accounting';
import type { WalletImportResult } from '@/types/wallet-movements';

const bodySchema = z.object({
  csv: z.string().min(1),
});

type ParsedRow = {
  line: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'expense' | 'income';
};

const HEADER_KEYS = ['date', 'description', 'amount', 'category', 'type'];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === ',') {
        out.push(cur);
        cur = '';
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(
  raw: string,
): { rows: ParsedRow[]; errors: { line: number; message: string }[] } {
  const errors: { line: number; message: string }[] = [];
  const rows: ParsedRow[] = [];

  const cleaned = raw.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors };

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx: Record<string, number> = {};
  for (const key of HEADER_KEYS) idx[key] = header.indexOf(key);

  for (const key of HEADER_KEYS) {
    if (idx[key] === -1) {
      errors.push({
        line: 1,
        message: `Falta la columna "${key}" en el encabezado`,
      });
    }
  }
  if (errors.length > 0) return { rows, errors };

  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    const date = parts[idx.date] ?? '';
    const description = parts[idx.description] ?? '';
    const amountStr = parts[idx.amount] ?? '';
    const category = parts[idx.category] ?? '';
    const typeStr = (parts[idx.type] ?? '').toLowerCase();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ line: i + 1, message: 'Fecha inválida (usa YYYY-MM-DD)' });
      continue;
    }
    if (!description) {
      errors.push({ line: i + 1, message: 'Descripción vacía' });
      continue;
    }
    const amount = Number(amountStr.replace(/[,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push({ line: i + 1, message: 'Monto inválido' });
      continue;
    }
    if (typeStr !== 'expense' && typeStr !== 'income') {
      errors.push({
        line: i + 1,
        message: 'Tipo debe ser "expense" o "income"',
      });
      continue;
    }
    rows.push({
      line: i + 1,
      date,
      description,
      amount,
      category,
      type: typeStr,
    });
  }
  return { rows, errors };
}

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

    const { rows, errors } = parseCsv(csv);
    const result: WalletImportResult = {
      imported: 0,
      skipped: errors.length,
      errors,
    };
    if (errors.length > 0 && rows.length === 0) {
      return NextResponse.json(result, { status: 200 });
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
            result.skipped++;
            result.errors.push({
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
                received_at: new Date(`${row.date}T12:00:00.000Z`),
                wallet_id: walletId,
                ...ownerData,
              },
            });
            await applyWalletAmountDelta(tx, walletId, row.amount);
          });
        }
        result.imported++;
      } catch (err) {
        result.skipped++;
        result.errors.push({
          line: row.line,
          message: err instanceof Error ? err.message : 'Error al importar',
        });
      }
    }

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
