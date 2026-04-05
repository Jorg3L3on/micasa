import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';

export type MonthlySummaryItem = {
  year: number;
  month: number;
  label: string;
  income: number;
  expense: number;
};

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET(request: NextRequest) {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Build list of last 12 months (oldest first)
    const months: { year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      months.push({ year: y, month: m });
    }

    // Build year-month tuples for the WHERE clause
    const yearMonthConditions = months.map(({ year, month }) => ({ year, month }));

    // Fetch fortnights for this owner within the 12-month window
    const fortnights = await prisma.fortnight.findMany({
      where: {
        ...ownerFilter,
        OR: yearMonthConditions,
      },
      select: { id: true, month: true, year: true },
    });

    const fortnightIds = fortnights.map((f) => f.id);
    const fortnightMap = new Map(fortnights.map((f) => [f.id, { month: f.month, year: f.year }]));

    if (fortnightIds.length === 0) {
      return NextResponse.json(
        months.map(({ year, month }) => ({
          year,
          month,
          label: MONTH_LABELS[month - 1],
          income: 0,
          expense: 0,
        })),
      );
    }

    // Aggregate expenses and incomes
    const [expenses, incomes] = await Promise.all([
      prisma.expense.findMany({
        where: { AND: [{ fortnight_id: { in: fortnightIds } }, ownerFilter] },
        select: { amount: true, fortnight_id: true },
      }),
      prisma.income.findMany({
        where: { AND: [{ fortnight_id: { in: fortnightIds } }, ownerFilter] },
        select: { amount: true, fortnight_id: true },
      }),
    ]);

    // Sum by month
    const byMonth = new Map<string, { income: number; expense: number }>();
    for (const { year, month } of months) {
      byMonth.set(`${year}-${month}`, { income: 0, expense: 0 });
    }

    for (const e of expenses) {
      const fn = fortnightMap.get(e.fortnight_id);
      if (!fn) continue;
      const key = `${fn.year}-${fn.month}`;
      const entry = byMonth.get(key);
      if (entry) entry.expense += Number(e.amount);
    }

    for (const i of incomes) {
      const fn = fortnightMap.get(i.fortnight_id);
      if (!fn) continue;
      const key = `${fn.year}-${fn.month}`;
      const entry = byMonth.get(key);
      if (entry) entry.income += Number(i.amount);
    }

    const result: MonthlySummaryItem[] = months.map(({ year, month }) => {
      const entry = byMonth.get(`${year}-${month}`) ?? { income: 0, expense: 0 };
      return {
        year,
        month,
        label: MONTH_LABELS[month - 1],
        income: Math.round(entry.income * 100) / 100,
        expense: Math.round(entry.expense * 100) / 100,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly summary' },
      { status: 500 },
    );
  }
}
