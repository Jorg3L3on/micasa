import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Returns list of (year, month) that already have both fortnights (FIRST and SECOND).
 * Used to exclude them from the "Create month" selector so each month can be created only once.
 */
export async function GET() {
  try {
    const fortnights = await prisma.fortnight.findMany({
      select: { year: true, month: true, period: true },
    });

    const hasFirst = new Set<string>();
    const hasSecond = new Set<string>();
    for (const f of fortnights) {
      const key = `${f.year}-${f.month}`;
      if (f.period === 'FIRST') hasFirst.add(key);
      if (f.period === 'SECOND') hasSecond.add(key);
    }

    const createdMonths: { year: number; month: number }[] = [];
    hasFirst.forEach((key) => {
      if (hasSecond.has(key)) {
        const [y, m] = key.split('-').map(Number);
        createdMonths.push({ year: y, month: m });
      }
    });

    createdMonths.sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );

    return NextResponse.json(createdMonths, { status: 200 });
  } catch (error) {
    console.error('Error fetching created months:', error);
    return NextResponse.json(
      { error: 'Error al obtener los meses creados' },
      { status: 500 },
    );
  }
}
