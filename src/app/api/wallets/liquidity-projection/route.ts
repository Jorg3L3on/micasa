import { NextRequest, NextResponse } from 'next/server';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  defaultLiquidityUntilFromAsOf,
  getLiquidityProjection,
} from '@/lib/finance/liquidity-projection.service';
import { liquidityProjectionToCsv } from '@/lib/finance/liquidity-projection-csv';
import { logFinanceEvent } from '@/lib/observability/finance-log';

const parseOptionalBool = (value: string | null): boolean | undefined => {
  if (value == null) return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
};

const parseStressPercent = (value: string | null): number | undefined => {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return undefined;
  return n;
};

/**
 * GET …/api/wallets/liquidity-projection
 * Query: until, omitZero, format=json|csv, stressCyclePercent, includeUnpaid, includeTemplates
 */
export async function GET(request: NextRequest) {
  const started = Date.now();
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;

    const { searchParams } = new URL(request.url);
    const untilParam = searchParams.get('until');
    const omitZeroParam = parseOptionalBool(searchParams.get('omitZero'));
    const format = searchParams.get('format') ?? 'json';
    const stressCyclePercent = parseStressPercent(
      searchParams.get('stressCyclePercent'),
    );
    const includeUnpaid = parseOptionalBool(searchParams.get('includeUnpaid'));
    const includeTemplates = parseOptionalBool(
      searchParams.get('includeTemplates'),
    );

    const asOf = new Date();
    const until = untilParam
      ? new Date(`${untilParam}T12:00:00.000Z`)
      : defaultLiquidityUntilFromAsOf(asOf);

    if (Number.isNaN(until.getTime())) {
      return NextResponse.json(
        { error: 'Parámetro "until" inválido (usa YYYY-MM-DD).' },
        { status: 400 },
      );
    }

    const projection = await getLiquidityProjection({
      ownerFilter: context.ownerFilter,
      asOf,
      until,
      omitZeroObligations: omitZeroParam ?? true,
      stressCyclePercent,
      includeUnpaidExpenses: includeUnpaid ?? true,
      includeExpenseTemplates: includeTemplates ?? true,
    });

    const ownerType = context.ownerType;
    const ownerId = context.ownerId;
    logFinanceEvent(
      'info',
      'finance.liquidity_projection.computed',
      {
        owner_type: ownerType,
        owner_id: ownerId,
        duration_ms: Date.now() - started,
        milestone_count: projection.milestones.length,
        obligation_lines: projection.milestones.reduce(
          (n, m) => n + m.obligations.length,
          0,
        ),
        format,
      },
      request,
    );

    if (format === 'csv') {
      const csv = liquidityProjectionToCsv(projection);
      const filename = `liquidez-${projection.as_of}-${projection.until}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json(projection, { status: 200 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'INVALID_HORIZON') {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 400 },
      );
    }
    console.error('liquidity-projection:', error);
    return NextResponse.json(
      { error: 'No se pudo calcular la proyección de liquidez.' },
      { status: 500 },
    );
  }
}
