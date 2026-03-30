import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { resolveCreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';

const labelFromMonthKey = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 15));
  return date
    .toLocaleDateString('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace('.', '');
};

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const cards = await prisma.wallet.findMany({
      where: {
        ...context.ownerFilter,
        type: { in: ['CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] },
        active: true,
        cutoff_day: { not: null },
        due_day: { not: null },
      },
      select: { id: true, name: true, cutoff_day: true, due_day: true },
    });

    const today = new Date();

    const projectionByCard = await Promise.all(
      cards.map(async (card) => {
        const window = resolveCreditCardStatementWindow(
          today,
          card.cutoff_day!,
          card.due_day!,
        );
        const seYear = window.statementEnd.getUTCFullYear();
        const seMonth = window.statementEnd.getUTCMonth() + 1;

        const installmentPurchases = await prisma.expense.findMany({
          where: {
            ...context.ownerFilter,
            wallet_id: card.id,
            is_paid: true,
            credit_installment_current: { not: null },
            credit_installment_total: { not: null },
          },
          select: {
            amount: true,
            credit_installment_current: true,
            credit_installment_total: true,
          },
        });

        const active = installmentPurchases.filter(
          (e) =>
            e.credit_installment_current != null &&
            e.credit_installment_total != null &&
            e.credit_installment_current < e.credit_installment_total,
        );

        const monthlyMap = new Map<string, number>();
        for (const purchase of active) {
          const remaining =
            purchase.credit_installment_total! - purchase.credit_installment_current!;
          for (let i = 1; i <= remaining; i++) {
            const futureDate = new Date(Date.UTC(seYear, seMonth - 1 + i, 1));
            const key = `${futureDate.getUTCFullYear()}-${String(futureDate.getUTCMonth() + 1).padStart(2, '0')}`;
            monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(purchase.amount));
          }
        }

        return { cardId: card.id, cardName: card.name, months: monthlyMap };
      }),
    );

    const allMonths = new Map<
      string,
      { total: number; cards: Array<{ cardId: number; cardName: string; amount: number }> }
    >();

    for (const { cardId, cardName, months } of projectionByCard) {
      for (const [monthKey, amount] of months) {
        if (!allMonths.has(monthKey)) {
          allMonths.set(monthKey, { total: 0, cards: [] });
        }
        const entry = allMonths.get(monthKey)!;
        entry.total += amount;
        entry.cards.push({ cardId, cardName, amount });
      }
    }

    const result = Array.from(allMonths.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, { total, cards }]) => ({
        monthKey,
        label: labelFromMonthKey(monthKey),
        total,
        cards,
      }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error computing installment projection:', error);
    return NextResponse.json(
      { error: 'No se pudo calcular la proyección de cuotas' },
      { status: 500 },
    );
  }
}
