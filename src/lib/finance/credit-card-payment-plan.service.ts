import prisma from '@/lib/prisma';
import type { FortnightPeriod } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { isCreditWalletType } from '@/lib/finance/wallet-accounting';
import type {
  CreditCardPaymentPlanView,
  DuePaymentItem,
} from '@/types/catalog';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import { reconcileDuePaymentItemCanonicalFields } from '@/lib/finance/card-statement-obligation';
import { todayCalendarDate } from '@/lib/calendar-dates';

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

export async function getCreditCardPaymentPlanViews(
  ownerFilter: OwnerFilter,
  walletId: number,
): Promise<CreditCardPaymentPlanView[]> {
  const card = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter, active: true },
    select: {
      id: true,
      type: true,
      due_day: true,
    },
  });

  if (!card || !isCreditWalletType(card.type) || card.due_day == null) {
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
  const [statement, plans] = await Promise.all([
    getCreditCardStatementByOwner(walletId, ownerFilter),
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
  ]);

  const planByFortnight = new Map(
    plans.map((plan) => [plan.fortnight_id, Number(plan.planned_amount)]),
  );

  const suggestedAmount = statement.next_due_payment;
  const outstandingBalance = statement.outstanding_balance;
  const paymentsAppliedToStatement = statement.payments_applied_to_statement;

  return fortnights
    .map((fortnight) => {
      const plannedPayment = planByFortnight.get(fortnight.id) ?? null;
      const effectiveAmount = getEffectiveCardPaymentAmount({
        nextDuePayment: suggestedAmount,
        plannedPayment,
        paymentsAppliedToStatement,
      });
      return {
        fortnightId: fortnight.id,
        fortnightLabel: fortnight.label,
        year: fortnight.year,
        month: fortnight.month,
        period: fortnight.period,
        isCurrentFortnight:
          fortnight.year === year &&
          fortnight.month === month &&
          fortnight.period === currentPeriod,
        suggestedAmount,
        plannedPayment,
        effectiveAmount,
        outstandingBalance,
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      if (a.period === b.period) return 0;
      return a.period === 'FIRST' ? -1 : 1;
    });
}

export async function attachPlannedPaymentsToDueItems(
  items: DuePaymentItem[],
  fortnightId: number | null | undefined,
  ownerFilter: OwnerFilter,
): Promise<void> {
  if (items.length === 0 || fortnightId == null) {
    for (const item of items) {
      item.plannedPayment = null;
      const canonical = reconcileDuePaymentItemCanonicalFields(
        item,
        todayCalendarDate(),
      );
      item.remainingPlannedAmount = canonical.remainingPlannedAmount;
      item.effectiveAmount = canonical.effectiveAmount;
      item.plannerStatus = canonical.plannerStatus;
    }
    return;
  }

  const walletIds = items.map((item) => item.walletId);
  const plans = await prisma.creditCardPaymentPlan.findMany({
    where: {
      fortnight_id: fortnightId,
      credit_card_wallet_id: { in: walletIds },
      ...ownerFilter,
    },
    select: {
      credit_card_wallet_id: true,
      planned_amount: true,
    },
  });

  const planByWallet = new Map(
    plans.map((plan) => [plan.credit_card_wallet_id, Number(plan.planned_amount)]),
  );

  for (const item of items) {
    item.plannedPayment = planByWallet.get(item.walletId) ?? null;
    const canonical = reconcileDuePaymentItemCanonicalFields(
      item,
      todayCalendarDate(),
    );
    item.remainingPlannedAmount = canonical.remainingPlannedAmount;
    item.effectiveAmount = canonical.effectiveAmount;
    item.plannerStatus = canonical.plannerStatus;
  }
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
