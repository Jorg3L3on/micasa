import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { listFortnightsForCatalog } from '@/lib/finance/fortnight.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const period = searchParams.get('period');

    // If specific params provided, return that fortnight (or null if not found)
    if (year && month && period) {
      const fortnight = await prisma.fortnight.findFirst({
        where: {
          year: parseInt(year, 10),
          month: parseInt(month, 10),
          period: period.toUpperCase() as 'FIRST' | 'SECOND',
        },
        select: {
          id: true,
          label: true,
          year: true,
          month: true,
          period: true,
        },
      });

      if (!fortnight) {
        return NextResponse.json(null, { status: 200 });
      }

      return NextResponse.json(
        {
          id: fortnight.id,
          label: fortnight.label,
          year: fortnight.year,
          month: fortnight.month,
          period: fortnight.period,
        },
        { status: 200 },
      );
    }

    const formatted = await listFortnightsForCatalog();
    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error al obtener las quincenas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las quincenas' },
      { status: 500 },
    );
  }
}