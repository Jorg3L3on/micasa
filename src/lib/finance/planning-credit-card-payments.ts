/**
 * Pagos a TC / tienda sin fila de Expense vinculada: deben sumar a la planificación
 * (salida de efectivo) por fecha de pago. Si hay expense_id, el gasto ya entra en el agregado normal.
 */

import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type FortnightDateBounds = { start_date: Date; end_date: Date };

export const unionPaidAtRangeFromFortnights = (
  fortnights: FortnightDateBounds[],
): { from: Date; to: Date } | null => {
  if (fortnights.length === 0) {
    return null;
  }
  let minT = fortnights[0].start_date.getTime();
  let maxT = fortnights[0].end_date.getTime();
  for (let i = 1; i < fortnights.length; i++) {
    minT = Math.min(minT, fortnights[i].start_date.getTime());
    maxT = Math.max(maxT, fortnights[i].end_date.getTime());
  }
  return { from: new Date(minT), to: new Date(maxT) };
};

export async function aggregateOrphanCreditCardPaymentsForPlanning(
  ownerFilter: OwnerFilter,
  paidAtRange: { from: Date; to: Date } | null,
): Promise<{ total: number; count: number }> {
  if (!paidAtRange) {
    return { total: 0, count: 0 };
  }

  const payments = await prisma.creditCardPayment.findMany({
    where: {
      ...ownerFilter,
      expense_id: null,
      paid_at: {
        gte: paidAtRange.from,
        lte: paidAtRange.to,
      },
    },
    select: { amount: true },
  });

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  return { total, count: payments.length };
}

export async function listOrphanCreditCardPaymentsForPlanning(
  ownerFilter: OwnerFilter,
  paidAtRange: { from: Date; to: Date } | null,
) {
  if (!paidAtRange) {
    return [];
  }

  return prisma.creditCardPayment.findMany({
    where: {
      ...ownerFilter,
      expense_id: null,
      paid_at: {
        gte: paidAtRange.from,
        lte: paidAtRange.to,
      },
    },
    include: {
      credit_card_wallet: { select: { name: true } },
      source_wallet: { select: { name: true, type: true } },
    },
    orderBy: { paid_at: 'desc' },
  });
}

export function buildFortnightWhereForReport(
  ownerFilter: OwnerFilter,
  month?: string | null,
  year?: string | null,
  period?: string | null,
): Prisma.FortnightWhereInput | null {
  if (!month && !year && !period) {
    return null;
  }
  const w: Prisma.FortnightWhereInput = { ...ownerFilter };
  if (month) {
    w.month = parseInt(month, 10);
  }
  if (year) {
    w.year = parseInt(year, 10);
  }
  if (period) {
    w.period = period as 'FIRST' | 'SECOND';
  }
  return w;
}
