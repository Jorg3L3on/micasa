import type { FortnightPeriod } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';
import { createExpenseInTransaction } from '@/lib/finance/expense.service';
import { getFortnightPeriodForDay } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';

type ParsedLinesForAmount = { line_total: unknown }[];

/**
 * Prefer footer total; otherwise sum line totals (same idea as receipt list display).
 */
export function resolveParsedReceiptExpenseAmount(params: {
  grand_total: unknown;
  lines: ParsedLinesForAmount;
}): number | null {
  const grand = decimalToNumber(params.grand_total);
  if (grand != null && grand > 0) {
    return Math.round(grand * 100) / 100;
  }
  const sum = params.lines.reduce(
    (acc, l) => acc + (decimalToNumber(l.line_total) ?? 0),
    0,
  );
  const rounded = Math.round(sum * 100) / 100;
  return rounded > 0 ? rounded : null;
}

export function buildPantryReceiptExpenseDescription(
  title: string | null,
  storeLabel: string | null,
): string {
  const t = title?.trim() || 'Despensa';
  if (storeLabel?.trim()) {
    return `${t} (${storeLabel.trim()})`;
  }
  return t;
}

export async function linkExpenseToPantryReceiptInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    ownerType: 'user' | 'house';
    ownerId: number;
    ownerFilter: OwnerFilter;
    receiptId: number;
    categoryId: number;
    walletId: number;
    expenseDateYmd: string;
    amount: number;
    description: string;
  },
) {
  const category = await tx.category.findFirst({
    where: { id: params.categoryId, ...params.ownerFilter },
  });
  if (!category) {
    const err = new Error('Categoría no encontrada') as Error & { code?: string };
    err.code = 'CATEGORY_NOT_FOUND';
    throw err;
  }

  const wallet = await tx.wallet.findFirst({
    where: { id: params.walletId, ...params.ownerFilter },
  });
  if (!wallet) {
    const err = new Error('Cartera no encontrada') as Error & { code?: string };
    err.code = 'WALLET_NOT_FOUND';
    throw err;
  }

  const parts = params.expenseDateYmd.split('-');
  if (parts.length !== 3) {
    const err = new Error('Fecha del gasto inválida') as Error & { code?: string };
    err.code = 'INVALID_DATE';
    throw err;
  }
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12
  ) {
    const err = new Error('Fecha del gasto inválida') as Error & { code?: string };
    err.code = 'INVALID_DATE';
    throw err;
  }

  const period = getFortnightPeriodForDay(day) as FortnightPeriod;

  const fortnight = await resolveOrCreateFortnight({
    ownerType: params.ownerType,
    ownerId: params.ownerId,
    year,
    month,
    period,
    tx,
  });

  const expense = await createExpenseInTransaction(tx, {
    fortnightId: fortnight.id,
    categoryId: params.categoryId,
    description: params.description,
    amount: params.amount,
    isPaid: true,
    paymentDate: params.expenseDateYmd,
    walletId: params.walletId,
    expenseTemplateId: null,
  });

  await tx.pantryReceipt.update({
    where: { id: params.receiptId },
    data: { linked_expense_id: expense.id },
  });

  return expense;
}

/** Map errors from expense registration (service / wallet) to API responses. */
export function responseForPantryExpenseRegistrationError(
  error: unknown,
): { status: number; message: string } | null {
  if (!error || typeof error !== 'object') return null;
  const code =
    'code' in error && typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null;
  if (!code) return null;

  const msg = error instanceof Error ? error.message : 'Error al registrar el gasto';

  switch (code) {
    case 'CREDIT_LIMIT_EXCEEDED':
    case 'INSUFFICIENT_WALLET_BALANCE':
    case 'INVALID_AMOUNT':
    case 'CATEGORY_NOT_FOUND':
    case 'WALLET_NOT_FOUND':
    case 'INVALID_FORTNIGHT':
    case 'INVALID_WALLET_OWNER':
    case 'INVALID_CREDIT_CARD':
    case 'INVALID_PAYMENT_SOURCE_WALLET':
    case 'INVALID_DATE':
      return { status: 400, message: msg };
    default:
      return null;
  }
}
