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
import {
  buildCardPlannerObligation,
  toPlannerDuePaymentFields,
} from '@/lib/finance/card-planner-obligation';
import { todayCalendarDate } from '@/lib/calendar-dates';

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
      item.plannerStatus =
        item.nextDuePayment <= 0 ? 'pagado' : 'por_pagar';
      item.isStaleFullyCoveredPlan = false;
    }
    return;
  }

  const walletIds = items.map((item) => item.walletId);
  const [plans, fortnightPayments] = await Promise.all([
    prisma.creditCardPaymentPlan.findMany({
      where: {
        fortnight_id: fortnightId,
        credit_card_wallet_id: { in: walletIds },
        ...ownerFilter,
      },
      select: {
        credit_card_wallet_id: true,
        planned_amount: true,
      },
    }),
    sumPaymentsAppliedToFortnightByWallet(
      fortnightId,
      walletIds,
      ownerFilter,
    ),
  ]);

  const planByWallet = new Map(
    plans.map((plan) => [
      plan.credit_card_wallet_id,
      Number(plan.planned_amount),
    ]),
  );

  for (const item of items) {
    const plannedGross = planByWallet.get(item.walletId) ?? null;
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
      });
      Object.assign(item, fields);
      continue;
    }

    const targetAmount = plannedGross ?? item.nextDuePayment;
    const remainingPlannerAmount = Math.max(
      targetAmount - paymentsAppliedToFortnight,
      0,
    );
    const visibleDueDate = item.statementDueDate;
    const plannerStatus =
      remainingPlannerAmount <= 0 &&
      (paymentsAppliedToFortnight > 0 ||
        (targetAmount <= 0 &&
          (item.paymentsAppliedToStatement > 0 || targetAmount <= 0)))
        ? 'pagado'
        : remainingPlannerAmount > 0 && todayYmd > visibleDueDate
          ? 'vencido'
          : 'por_pagar';

    item.plannedPayment = plannedGross;
    item.paymentsAppliedToFortnight = paymentsAppliedToFortnight;
    item.remainingPlannerAmount = remainingPlannerAmount;
    item.effectiveAmount = remainingPlannerAmount;
    item.visibleDueDate = visibleDueDate;
    item.targetAmount = targetAmount;
    item.plannerStatus = plannerStatus;
    item.isStaleFullyCoveredPlan =
      plannedGross != null &&
      plannedGross > 0 &&
      remainingPlannerAmount <= 0 &&
      paymentsAppliedToFortnight > 0;
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
}): CreditCardPaymentPlanView => ({
  fortnightId: input.fortnight.id,
  fortnightLabel: input.fortnight.label,
  year: input.fortnight.year,
  month: input.fortnight.month,
  period: input.fortnight.period,
  isCurrentFortnight: input.isCurrentFortnight,
  suggestedAmount: input.fields.nextDuePayment,
  plannedPayment: input.fields.plannedPayment,
  effectiveAmount: input.fields.effectiveAmount,
  outstandingBalance: input.fields.outstandingBalance,
  plannerStatus: input.fields.plannerStatus,
  obligationAmountSource: input.fields.obligationAmountSource,
  isEstimate: input.fields.isEstimate,
  remainingPlannerAmount: input.fields.remainingPlannerAmount,
  paymentsAppliedToStatement: input.fields.paymentsAppliedToStatement,
  paymentsAppliedToFortnight: input.fields.paymentsAppliedToFortnight,
  statementDueDate: input.fields.statementDueDate,
  visibleDueDate: input.fields.visibleDueDate,
  targetAmount: input.fields.targetAmount,
  isStaleFullyCoveredPlan: input.fields.isStaleFullyCoveredPlan,
});
