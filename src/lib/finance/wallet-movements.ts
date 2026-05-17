import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { WalletMovement } from '@/types/wallet-movements';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toISODate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().split('T')[0];
}

type DateRange = { fromDate: Date; toDate: Date };

function buildRange(from: string, to: string): DateRange {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);
  return { fromDate, toDate };
}

export async function listWalletMovements(
  walletId: number,
  ownerFilter: OwnerFilter,
  from: string,
  to: string,
): Promise<WalletMovement[]> {
  const { fromDate, toDate } = buildRange(from, to);

  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...ownerFilter,
        wallet_id: walletId,
        OR: [
          { payment_date: { gte: fromDate, lte: toDate } },
          {
            AND: [
              { payment_date: null },
              { created_at: { gte: fromDate, lte: toDate } },
            ],
          },
        ],
      },
      include: {
        category: { select: { name: true, icon: true } },
        fortnight: { select: { year: true, month: true, period: true } },
      },
    }),
    prisma.income.findMany({
      where: {
        ...ownerFilter,
        wallet_id: walletId,
        received_at: { gte: fromDate, lte: toDate },
      },
      include: {
        fortnight: { select: { year: true, month: true, period: true } },
      },
    }),
  ]);

  const items: WalletMovement[] = [];

  for (const e of expenses) {
    items.push({
      id: e.id,
      kind: 'expense',
      date: toISODate(e.payment_date ?? e.created_at),
      description: e.description,
      amount: toNumber(e.amount),
      direction: 'out',
      category: e.category?.name ?? null,
      categoryIcon: e.category?.icon ?? null,
      fortnightYear: e.fortnight?.year ?? null,
      fortnightMonth: e.fortnight?.month ?? null,
      fortnightPeriod: (e.fortnight?.period as 'FIRST' | 'SECOND') ?? null,
    });
  }

  for (const i of incomes) {
    items.push({
      id: i.id,
      kind: 'income',
      date: toISODate(i.received_at),
      description: i.source ?? 'Ingreso',
      amount: toNumber(i.amount),
      direction: 'in',
      category: null,
      categoryIcon: null,
      fortnightYear: i.fortnight?.year ?? null,
      fortnightMonth: i.fortnight?.month ?? null,
      fortnightPeriod: (i.fortnight?.period as 'FIRST' | 'SECOND') ?? null,
    });
  }

  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id - a.id;
  });

  return items;
}

export function computeMovementTotals(movements: WalletMovement[]): {
  inflow: number;
  outflow: number;
  net: number;
} {
  let inflow = 0;
  let outflow = 0;
  for (const m of movements) {
    if (m.direction === 'in') inflow += m.amount;
    else outflow += m.amount;
  }
  return { inflow, outflow, net: inflow - outflow };
}
