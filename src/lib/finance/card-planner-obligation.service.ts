import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type {
  CreditCardPaymentPlanView,
  DuePaymentItem,
} from '@/types/catalog';
import {
  buildCardStatementObligation,
  type BuildCardStatementObligationInput,
} from '@/lib/finance/card-statement-obligation';
import { applyPeriodObligation } from '@/lib/finance/card-period-obligation';
import {
  selectActivePlannedOverride,
  statementCycleForDate,
  toStoredPaymentPlanWrite,
} from '@/lib/finance/card-payment-plan-scope';
import { parseCalendarDate, todayCalendarDate } from '@/lib/calendar-dates';
import {
  buildCardPlannerObligation,
  derivePlannerStatus,
  isPlannerPlanStale,
  toPlannerDuePaymentFields,
} from '@/lib/finance/card-planner-obligation';

/** Treat non-positive plans as absent (legacy $0 rows must not force pagado). */
const normalizePlannedGross = (raw: number | null | undefined): number | null =>
  raw != null && raw > 0 ? raw : null;

const creditPaymentOwnerWhereSql = (ownerFilter: OwnerFilter) => {
  if (ownerFilter.user_id != null) {
    return Prisma.sql`p."user_id" = ${ownerFilter.user_id} AND p."house_id" IS NULL`;
  }
  return Prisma.sql`p."house_id" = ${ownerFilter.house_id} AND p."user_id" IS NULL`;
};

export const sumPaymentsAppliedToFortnightByWallet = async (
  fortnightId: number,
  walletIds: number[],
  ownerFilter: OwnerFilter,
): Promise<Map<number, number>> => {
  if (walletIds.length === 0) {
    return new Map();
  }

  const ownerSql = creditPaymentOwnerWhereSql(ownerFilter);
  const rows = await prisma.$queryRaw<
    Array<{ credit_card_wallet_id: number; total: unknown }>
  >`
    SELECT p."credit_card_wallet_id", COALESCE(SUM(p."amount"), 0) AS total
    FROM "CreditCardPayment" p
    INNER JOIN "Expense" e ON e."id" = p."expense_id"
    WHERE e."fortnight_id" = ${fortnightId}
      AND p."credit_card_wallet_id" IN (${Prisma.join(walletIds)})
      AND ${ownerSql}
    GROUP BY p."credit_card_wallet_id"
  `;

  const map = new Map<number, number>();
  for (const row of rows ?? []) {
    map.set(row.credit_card_wallet_id, Number(row.total));
  }
  return map;
};

type StatementObligationSeed = Omit<
  BuildCardStatementObligationInput,
  'plannedGrossAmount'
>;

export const buildPlannerFieldsFromStatement = (input: {
  fortnightId: number;
  statement: StatementObligationSeed;
  plannedGrossAmount: number | null;
  paymentsAppliedToFortnight: number;
  todayYmd?: string;
  explicitZero?: boolean;
}) => {
  const statementObligation = buildCardStatementObligation({
    ...input.statement,
    plannedGrossAmount: null,
    todayYmd: input.todayYmd,
  });
  const planner = buildCardPlannerObligation({
    fortnightId: input.fortnightId,
    statement: statementObligation,
    plannedGrossAmount: input.plannedGrossAmount,
    paymentsAppliedToFortnight: input.paymentsAppliedToFortnight,
    todayYmd: input.todayYmd,
    explicitZero: input.explicitZero,
  });
  return toPlannerDuePaymentFields(planner);
};

/**
 * Applies fortnight-scoped planner layer to due-payment rows (Pagos tarjeta tab).
 */
export async function applyPlannerLayerToDueItems(
  items: DuePaymentItem[],
  fortnightId: number | null | undefined,
  ownerFilter: OwnerFilter,
  statementSeeds?: Map<number, StatementObligationSeed>,
): Promise<void> {
  const todayYmd = todayCalendarDate();

  if (items.length === 0 || fortnightId == null) {
    for (const item of items) {
      item.plannedPayment = null;
      item.paymentsAppliedToFortnight = 0;
      item.remainingPlannerAmount = item.nextDuePayment;
      item.effectiveAmount = item.nextDuePayment;
      item.visibleDueDate = item.statementDueDate;
      item.targetAmount = item.nextDuePayment;
      item.plannerStatus = derivePlannerStatus({
        remainingPlannerAmount: item.nextDuePayment,
        paymentsAppliedToFortnight: 0,
        paymentsAppliedToStatement: item.paymentsAppliedToStatement,
        targetAmount: item.nextDuePayment,
        outstandingBalance: item.outstandingBalance,
        visibleDueDate: item.statementDueDate,
        todayYmd,
      });
      item.isStaleFullyCoveredPlan = false;
      applyPeriodObligation(item);
    }
    return;
  }

  const walletIds = items.map((item) => item.walletId);
  const [plans, fortnightPayments] = await Promise.all([
    prisma.creditCardPaymentPlan.findMany({
      where: {
        credit_card_wallet_id: { in: walletIds },
        ...ownerFilter,
      },
      select: {
        credit_card_wallet_id: true,
        planned_amount: true,
        declared_zero: true,
        scope: true,
        cycle_count: true,
        valid_until: true,
        anchor_statement_end: true,
        updated_at: true,
        created_at: true,
        fortnight: { select: { year: true, month: true } },
      },
    }),
    sumPaymentsAppliedToFortnightByWallet(
      fortnightId,
      walletIds,
      ownerFilter,
    ),
  ]);

  const writesByWallet = new Map<number, ReturnType<typeof toStoredPaymentPlanWrite>[]>();
  for (const plan of plans) {
    const list = writesByWallet.get(plan.credit_card_wallet_id) ?? [];
    list.push(toStoredPaymentPlanWrite(plan));
    writesByWallet.set(plan.credit_card_wallet_id, list);
  }

  for (const item of items) {
    const target = statementCycleForDate(
      parseCalendarDate(item.statementDueDate),
      item.cutoff_day,
      item.dueDay,
    );
    const active = selectActivePlannedOverride(
      writesByWallet.get(item.walletId) ?? [],
      target,
      { cutoffDay: item.cutoff_day, dueDay: item.dueDay },
    );
    const plannedGross = normalizePlannedGross(active.plannedOverride);
    const explicitZero = active.explicitZero;
    item.planScope = active.scope;
    item.planCycleCount = active.cycleCount;
    item.planValidUntil = active.validUntil;
    const paymentsAppliedToFortnight =
      fortnightPayments.get(item.walletId) ?? 0;

    const seed = statementSeeds?.get(item.walletId);
    if (seed != null) {
      const fields = buildPlannerFieldsFromStatement({
        fortnightId,
        statement: seed,
        plannedGrossAmount: plannedGross,
        paymentsAppliedToFortnight,
        todayYmd,
        explicitZero,
      });
      Object.assign(item, fields);
      item.declaredZero = explicitZero;
      applyPeriodObligation(item);
      continue;
    }

    const targetAmount = plannedGross ?? item.nextDuePayment;
    const remainingPlannerAmount = Math.max(
      targetAmount - paymentsAppliedToFortnight,
      0,
    );
    const visibleDueDate = item.statementDueDate;
    const plannerStatus = derivePlannerStatus({
      remainingPlannerAmount,
      paymentsAppliedToFortnight,
      paymentsAppliedToStatement: item.paymentsAppliedToStatement,
      targetAmount,
      outstandingBalance: item.outstandingBalance,
      visibleDueDate,
      todayYmd,
    });

    item.plannedPayment = plannedGross;
    item.paymentsAppliedToFortnight = paymentsAppliedToFortnight;
    item.remainingPlannerAmount = remainingPlannerAmount;
    item.effectiveAmount = remainingPlannerAmount;
    item.visibleDueDate = visibleDueDate;
    item.targetAmount = targetAmount;
    item.plannerStatus = plannerStatus;
    item.isStaleFullyCoveredPlan = isPlannerPlanStale({
      plannedGrossAmount: plannedGross,
      remainingPlannerAmount,
      paymentsAppliedToFortnight,
    });
    item.declaredZero = explicitZero;
    applyPeriodObligation(item);
  }
}

export const toCreditCardPaymentPlanView = (input: {
  fortnight: {
    id: number;
    label: string;
    year: number;
    month: number;
    period: 'FIRST' | 'SECOND';
  };
  isCurrentFortnight: boolean;
  fields: ReturnType<typeof toPlannerDuePaymentFields>;
}): CreditCardPaymentPlanView => {
  const obligationCarrier = {
    outstandingBalance: input.fields.outstandingBalance,
    nextDuePayment: input.fields.nextDuePayment,
    obligationAmountSource: input.fields.obligationAmountSource,
    isEstimate: input.fields.isEstimate,
    plannedPayment: input.fields.plannedPayment,
    paymentsAppliedToStatement: input.fields.paymentsAppliedToStatement,
    paymentsAppliedToFortnight: input.fields.paymentsAppliedToFortnight,
    statementPayoff: input.fields.statementPayoff,
    minimumPayment: input.fields.minimumPayment,
    declaredZero: input.fields.declaredZero,
    plannerStatus: input.fields.plannerStatus,
    effectiveAmount: input.fields.effectiveAmount,
    remainingPlannerAmount: input.fields.remainingPlannerAmount,
  };
  const periodObligation = applyPeriodObligation(obligationCarrier);

  return {
    fortnightId: input.fortnight.id,
    fortnightLabel: input.fortnight.label,
    year: input.fortnight.year,
    month: input.fortnight.month,
    period: input.fortnight.period,
    isCurrentFortnight: input.isCurrentFortnight,
    plannedPayment: input.fields.plannedPayment,
    effectiveAmount:
      obligationCarrier.effectiveAmount ?? input.fields.effectiveAmount,
    outstandingBalance: input.fields.outstandingBalance,
    plannerStatus: obligationCarrier.plannerStatus,
    obligationAmountSource: input.fields.obligationAmountSource,
    isEstimate: input.fields.isEstimate,
    remainingPlannerAmount:
      obligationCarrier.remainingPlannerAmount ??
      input.fields.remainingPlannerAmount,
    paymentsAppliedToStatement: input.fields.paymentsAppliedToStatement,
    paymentsAppliedToFortnight: input.fields.paymentsAppliedToFortnight,
    statementDueDate: input.fields.statementDueDate,
    visibleDueDate: input.fields.visibleDueDate,
    targetAmount: input.fields.targetAmount,
    isStaleFullyCoveredPlan: input.fields.isStaleFullyCoveredPlan,
    periodObligation,
    declaredZero: input.fields.declaredZero,
  };
};
