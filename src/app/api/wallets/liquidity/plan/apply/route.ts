import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import { buildCashPlan, planInputFromLiquidity } from '@/lib/finance/cash-plan';
import { applyCashPlan } from '@/lib/finance/cash-plan/apply-plan.service';
import { toCents } from '@/lib/finance/cash-plan/money';
import type { ActionInstance } from '@/lib/finance/cash-plan/types';
import { DomainError } from '@/lib/finance/domain-error';
import { monthKeyToUntilDate, resolveLiquidityFetchWindow } from '@/lib/finance/liquidity-chart-range';
import { getLiquidityProjection } from '@/lib/finance/liquidity-projection.service';
import { logFinanceEvent } from '@/lib/observability/finance-log';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { withOwnerContext } from '@/lib/server/with-owner-context';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { cashPlanApplySchema, type CashPlanApplyInput } from '@/schemas/cash-plan-apply.schema';

type ClientAction = CashPlanApplyInput['actions'][number];

const numericId = (obligationId: string | null | undefined, prefix: string): number | null => {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(obligationId ?? '');
  return match ? Number(match[1]) : null;
};

/** Every card, loan and expense the client names must belong to this owner context. */
const foreignReference = async (ownerFilter: OwnerFilter, actions: ClientAction[]): Promise<string | null> => {
  for (const action of actions) {
    const cardId = numericId(action.obligationId, 'card');
    if (cardId != null) {
      const wallet = await prisma.wallet.findFirst({ where: { id: cardId, ...ownerFilter }, select: { id: true } });
      if (!wallet) return action.obligationId!;
    }
    const loanId = numericId(action.obligationId, 'loan');
    if (loanId != null) {
      const loan = await prisma.loan.findFirst({ where: { id: loanId, ...ownerFilter }, select: { id: true } });
      if (!loan) return action.obligationId!;
    }
    const billId = numericId(action.obligationId, 'bill');
    if (billId != null) {
      const [expense, template] = await Promise.all([
        prisma.expense.findFirst({ where: { id: billId, ...ownerFilter }, select: { id: true } }),
        prisma.expenseTemplate.findFirst({ where: { id: billId, ...ownerFilter }, select: { id: true } }),
      ]);
      if (!expense && !template) return action.obligationId!;
    }
  }
  return null;
};

const sameSteps = (client: ClientAction[], server: readonly ActionInstance[]): boolean =>
  client.length === server.length
  && client.every((step, index) => {
    const other = server[index]!;
    return step.type === other.type
      && (step.obligationId ?? null) === (other.obligationId ?? null)
      && toCents(step.amount ?? 0) === toCents(other.amount ?? 0);
  });

/**
 * POST /api/wallets/liquidity/plan/apply
 * Recomputes the plan from the owner's projection, checks that the chosen
 * route and its steps match what the client showed (409 otherwise), and
 * writes each step to an existing model. Returns the writes and the skips.
 */
export async function POST(request: NextRequest) {
  try {
    return await withOwnerContext(request, async (context) => {
      const parsed = cashPlanApplySchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Solicitud inválida', code: 'INVALID_BODY', issues: parsed.error.issues },
          { status: 400 },
        );
      }
      const body = parsed.data;

      const foreign = await foreignReference(context.ownerFilter, body.actions);
      if (foreign) {
        return NextResponse.json(
          { error: 'Uno de los pasos no pertenece a esta cuenta.', code: 'NOT_OWNER', obligationId: foreign },
          { status: 400 },
        );
      }

      const asOf = new Date();
      const asOfYmd = formatCalendarDate(asOf);
      const fetchWindow = resolveLiquidityFetchWindow(asOfYmd);
      // Same object the GET route serializes; the planner reads milestones, summary and series only.
      const projection = (await getLiquidityProjection({
        ownerFilter: context.ownerFilter,
        asOf,
        until: monthKeyToUntilDate(fetchWindow.toMonthKey),
        fromMonthKey: fetchWindow.fromMonthKey,
        omitZeroObligations: true,
        includeUnpaidExpenses: true,
        includeExpenseTemplates: true,
      })) as unknown as LiquidityProjectionResponse;
      const input = planInputFromLiquidity({
        projection,
        monthKey: body.monthKey,
        horizon: body.horizon,
        asOfYmd: projection.as_of,
        bridgeSim: body.bridgeSim ?? null,
        consolidateSim: body.consolidateSim ?? null,
        computedAt: parseCalendarDate(projection.as_of).toISOString(),
      });
      const plan = buildCashPlan(input);
      const route = [plan.primary, ...plan.alternatives].find((item) => item.id === body.routeId);
      if (!route || !sameSteps(body.actions, route.actions)) {
        return NextResponse.json(
          {
            error: 'Tu plan cambió desde que lo abriste. Recarga para ver la ruta actualizada.',
            code: 'PLAN_MISMATCH',
          },
          { status: 409 },
        );
      }

      const result = await applyCashPlan({
        ownerFilter: context.ownerFilter,
        actions: route.actions,
        obligations: input.obligations,
        projection,
      });

      logFinanceEvent(
        'info',
        'finance.cash_plan.applied',
        {
          owner_type: context.ownerType,
          owner_id: context.ownerId,
          route_id: route.id,
          writes: result.writes.length,
          skipped: result.skipped.length,
        },
        request,
      );
      return NextResponse.json(result, { status: 200 });
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    logFinanceEvent('warn', 'finance.cash_plan.apply_failed', { message: (error as Error).message }, request);
    return NextResponse.json({ error: 'No se pudo activar el plan.' }, { status: 500 });
  }
}
