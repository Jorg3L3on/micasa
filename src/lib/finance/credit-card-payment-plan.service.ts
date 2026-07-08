import prisma from '@/lib/prisma';
import type { FortnightPeriod } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import type {
  CreditCardPaymentPlanView,
  DuePaymentItem,
} from '@/types/catalog';
import {
  resolveCreditCardStatementWindow,
} from '@/lib/finance/card-statement-obligation';
import { parseCalendarDate, todayCalendarDate } from '@/lib/calendar-dates';
import {
  applyPlannerLayerToDueItems,
  buildPlannerFieldsFromStatement,
  sumPaymentsAppliedToFortnightByWallet,
  toCreditCardPaymentPlanView,
} from '@/lib/finance/card-planner-obligation.service';

export { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

type PlannerFortnightKey = {
  year: number;
  month: number;
  period: FortnightPeriod;
};

const plannerPeriodForDueDay = (dueDay: number): FortnightPeriod =>
  dueDay >= 1 && dueDay <= 15 ? 'FIRST' : 'SECOND';

const dueDayMatchesPlannerPeriod = (
  dueDay: number,
  period: FortnightPeriod,
): boolean =>
  period === 'FIRST' ? dueDay >= 1 && dueDay <= 15 : dueDay >= 16;

const nextCalendarFortnight = (
  year: number,
  month: number,
  asOf: Date,
): PlannerFortnightKey => {
  const isFirst = asOf.getDate() <= 15;
  if (isFirst) {
    return { year, month, period: 'SECOND' };
  }
  if (month === 12) {
    return { year: year + 1, month: 1, period: 'FIRST' };
  }
  return { year, month: month + 1, period: 'FIRST' };
};

const fortnightKey = (key: PlannerFortnightKey) =>
  `${key.year}-${key.month}-${key.period}`;

const clampDayToMonth = (year: number, month: number, day: number) =>
  Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());

const createCalendarDate = (year: number, month: number, day: number) =>
  parseCalendarDate(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

export async function getCreditCardPaymentPlanViews(
  ownerFilter: OwnerFilter,
  walletId: number,
): Promise<CreditCardPaymentPlanView[]> {
  const card = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter, active: true },
    select: {
      id: true,
      name: true,
      type: true,
      cutoff_day: true,
      due_day: true,
    },
  });

  if (
    !card ||
    !isCreditWalletType(card.type) ||
    card.due_day == null ||
    card.cutoff_day == null
  ) {
    return [];
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dueDay = card.due_day;
  const currentPeriod: FortnightPeriod = now.getDate() <= 15 ? 'FIRST' : 'SECOND';

  const keys: PlannerFortnightKey[] = [
    { year, month, period: plannerPeriodForDueDay(dueDay) },
  ];

  const nextCal = nextCalendarFortnight(year, month, now);
  if (
    dueDayMatchesPlannerPeriod(dueDay, nextCal.period) &&
    fortnightKey(nextCal) !== fortnightKey(keys[0]!)
  ) {
    keys.push(nextCal);
  }

  const uniqueKeys = Array.from(
    new Map(keys.map((key) => [fortnightKey(key), key])).values(),
  );

  const fortnights = await prisma.fortnight.findMany({
    where: {
      ...ownerFilter,
      OR: uniqueKeys.map((key) => ({
        year: key.year,
        month: key.month,
        period: key.period,
      })),
    },
    select: {
      id: true,
      label: true,
      year: true,
      month: true,
      period: true,
    },
  });

  if (fortnights.length === 0) {
    return [];
  }

  const fortnightIds = fortnights.map((f) => f.id);
  const [plans, fortnightPayments] = await Promise.all([
    prisma.creditCardPaymentPlan.findMany({
      where: {
        credit_card_wallet_id: walletId,
        fortnight_id: { in: fortnightIds },
        ...ownerFilter,
      },
      select: {
        fortnight_id: true,
        planned_amount: true,
      },
    }),
    Promise.all(
      fortnights.map(async (fortnight) => ({
        fortnightId: fortnight.id,
        total:
          (
            await sumPaymentsAppliedToFortnightByWallet(
              fortnight.id,
              [walletId],
              ownerFilter,
            )
          ).get(walletId) ?? 0,
      })),
    ),
  ]);

  const planByFortnight = new Map(
    plans.map((plan) => [plan.fortnight_id, Number(plan.planned_amount)]),
  );
  const paymentsByFortnight = new Map(
    fortnightPayments.map((row) => [row.fortnightId, row.total]),
  );

  const todayYmd = todayCalendarDate();

  const views = await Promise.all(
    fortnights.map(async (fortnight) => {
      const asOf = createCalendarDate(
        fortnight.year,
        fortnight.month,
        clampDayToMonth(fortnight.year, fortnight.month, dueDay),
      );
      const statement = await getCreditCardStatementByOwner(
        walletId,
        ownerFilter,
        asOf,
      );
      const window = resolveCreditCardStatementWindow(
        asOf,
        card.cutoff_day!,
        card.due_day!,
      );
      const plannedGross = planByFortnight.get(fortnight.id) ?? null;
      const paymentsAppliedToFortnight =
        paymentsByFortnight.get(fortnight.id) ?? 0;

      const fields = buildPlannerFieldsFromStatement({
        fortnightId: fortnight.id,
        statement: {
          walletId: card.id,
          walletName: card.name,
          walletType: card.type,
          cutoffDay: card.cutoff_day!,
          dueDay: card.due_day!,
          window,
          lastStatementBalance: statement.last_statement_balance,
          paymentsAppliedToStatement: statement.payments_applied_to_statement,
          importedTotalDue: statement.imported_statement_total,
          outstandingBalance: statement.outstanding_balance,
          currentCyclePurchasesTotal: statement.current_cycle_purchases,
          currentCyclePaymentsTotal: statement.current_cycle_payments,
          asOfYmd: todayYmd,
        },
        plannedGrossAmount: plannedGross,
        paymentsAppliedToFortnight,
        todayYmd,
      });

      return toCreditCardPaymentPlanView({
        fortnight,
        isCurrentFortnight:
          fortnight.year === year &&
          fortnight.month === month &&
          fortnight.period === currentPeriod,
        fields,
      });
    }),
  );

  return views.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    if (a.period === b.period) return 0;
    return a.period === 'FIRST' ? -1 : 1;
  });
}

/** @deprecated Use applyPlannerLayerToDueItems from card-planner-obligation.service */
export async function attachPlannedPaymentsToDueItems(
  items: DuePaymentItem[],
  fortnightId: number | null | undefined,
  ownerFilter: OwnerFilter,
): Promise<void> {
  await applyPlannerLayerToDueItems(items, fortnightId, ownerFilter);
}

export async function resolveFortnightIdForDate(
  ownerFilter: OwnerFilter,
  asOf: Date,
): Promise<number | null> {
  const year = asOf.getFullYear();
  const month = asOf.getMonth() + 1;
  const period = asOf.getDate() <= 15 ? 'FIRST' : 'SECOND';

  const fortnight = await prisma.fortnight.findFirst({
    where: {
      ...ownerFilter,
      year,
      month,
      period,
    },
    select: { id: true },
  });

  return fortnight?.id ?? null;
}

export async function upsertCreditCardPaymentPlan(
  ownerFilter: OwnerFilter,
  fortnightId: number,
  walletId: number,
  plannedAmount: number,
) {
  const [fortnight, wallet] = await Promise.all([
    prisma.fortnight.findFirst({
      where: { id: fortnightId, ...ownerFilter },
      select: { id: true },
    }),
    prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter, active: true },
      select: { id: true, type: true, amount: true },
    }),
  ]);

  if (!fortnight) {
    const error = new Error('Quincena no encontrada');
    (error as { code?: string }).code = 'FORTNIGHT_NOT_FOUND';
    throw error;
  }

  if (!wallet || !isCreditWalletType(wallet.type)) {
    const error = new Error('Tarjeta no encontrada');
    (error as { code?: string }).code = 'WALLET_NOT_FOUND';
    throw error;
  }

  const outstandingBalance = Number(wallet.amount);
  if (plannedAmount > outstandingBalance) {
    const error = new Error(
      'El monto planeado no puede superar la deuda actual de la tarjeta',
    );
    (error as { code?: string }).code = 'AMOUNT_EXCEEDS_BALANCE';
    throw error;
  }

  const isUserContext = ownerFilter.user_id !== null;

  return prisma.creditCardPaymentPlan.upsert({
    where: {
      credit_card_wallet_id_fortnight_id: {
        credit_card_wallet_id: walletId,
        fortnight_id: fortnightId,
      },
    },
    create: {
      credit_card_wallet_id: walletId,
      fortnight_id: fortnightId,
      planned_amount: plannedAmount,
      user_id: isUserContext ? ownerFilter.user_id : null,
      house_id: !isUserContext ? ownerFilter.house_id : null,
    },
    update: {
      planned_amount: plannedAmount,
    },
    select: {
      credit_card_wallet_id: true,
      fortnight_id: true,
      planned_amount: true,
    },
  });
}

export async function clearCreditCardPaymentPlan(
  ownerFilter: OwnerFilter,
  fortnightId: number,
  walletId: number,
) {
  const fortnight = await prisma.fortnight.findFirst({
    where: { id: fortnightId, ...ownerFilter },
    select: { id: true },
  });

  if (!fortnight) {
    const error = new Error('Quincena no encontrada');
    (error as { code?: string }).code = 'FORTNIGHT_NOT_FOUND';
    throw error;
  }

  await prisma.creditCardPaymentPlan.deleteMany({
    where: {
      fortnight_id: fortnightId,
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
  });
}
