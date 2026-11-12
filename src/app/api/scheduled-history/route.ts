import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import { listScheduledHistoryForOwner } from '@/lib/finance/scheduled-history.service';

const querySchema = z.object({
  kind: z.enum(['expense', 'income']),
  id: z.coerce.number().int().positive(),
});

/**
 * GET /api/scheduled-history?kind=expense|income&id=N (plus the owner params):
 * the last three gastos or ingresos created from one programado of the
 * active owner. 404 when the item is not the owner's.
 */
export async function GET(request: NextRequest) {
  try {
    return await withOwnerContext(request, async ({ ownerFilter }) => {
      const params = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = querySchema.safeParse(params);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
      }
      const entries = await listScheduledHistoryForOwner(
        ownerFilter,
        parsed.data.kind,
        parsed.data.id,
      );
      if (entries === null) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(entries, { status: 200 });
    });
  } catch (error) {
    console.error('Error fetching scheduled history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled history' },
      { status: 500 },
    );
  }
}
