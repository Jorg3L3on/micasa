import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { listFortnightsForCatalog } from '@/lib/finance/fortnight.service';

/**
 * GET /fortnights?ownerType=user|house&ownerId=number
 * Returns only fortnights belonging to the owner (user_id or house_id).
 * Optional: year, month, period for a single fortnight.
 * Fallback: missing/invalid params use session user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { ownerFilter } = context;

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const period = searchParams.get('period');

    if (year && month && period) {
      const fortnight = await prisma.fortnight.findFirst({
        where: {
          ...ownerFilter,
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

    const formatted = await listFortnightsForCatalog(ownerFilter);
    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error('Error al obtener las quincenas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las quincenas' },
      { status: 500 },
    );
  }
}