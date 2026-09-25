import prisma from '@/lib/prisma';
import { CardPaymentPlanScope, type FortnightPeriod } from '@/generated/prisma/client';
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
import {
  formatCalendarDate,
  parseDateOnly,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import {
  isStalePastDueGap,
  plannerAsOfForCardMonth,
} from '@/lib/finance/card-obligation-cycle';
import {
  selectActivePlannedOverride,
  statementCycleForMonth,
  toStoredPaymentPlanWrite,
  writeCoversCycle,
  type CardPaymentPlanScopeKind,
} from '@/lib/finance/card-payment-plan-scope';
import {
  applyPlannerLayerToDueItems,
  buildPlannerFieldsFromStatement,
  sumPaymentsAppliedToFortnightByWallet,
  toCreditCardPaymentPlanView,
} from '@/lib/finance/card-planner-obligation.service';
import { paymentPlanFortnightKeys } from '@/lib/finance/card-payment-plan-fortnights';
import {
  getCurrentCalendarFortnightRef,
  getCalendarFortnightRefForYmd,
} from '@/lib/fortnight-calendar';

export { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

type PlannerFortnightKey = {
  year: number;
  month: number;
  period: FortnightPeriod;
};

const fortnightKey = (key: PlannerFortnightKey) =>
  `${key.year}-${key.month}-${key.period}`;

const planSelect = {
  id: true,
  planned_amount: true,
  declared_zero: true,
  scope: true,
  cycle_count: true,
  valid_until: true,
  anchor_statement_end: true,
  updated_at: true,
  created_at: true,
  fortnight_id: true,
  fortnight: { select: { year: true, month: true, period: true } },
} as const;

const toPrismaScope = (scope: CardPaymentPlanScopeKind): CardPaymentPlanScope => {
  if (scope === 'n_cycles') return CardPaymentPlanScope.N_CYCLES;
  if (scope === 'until_date') return CardPaymentPlanScope.UNTIL_DATE;
  return CardPaymentPlanScope.THIS_CYCLE;
};

export type UpsertCardPaymentPlanOptions = {
  declareZero?: boolean;
  scope?: CardPaymentPlanScopeKind;
  cycleCount?: number | null;
  validUntil?: string | null;
};

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
      minimum_payment: true,
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
  const dueDay = card.due_day;
  const current = getCurrentCalendarFortnightRef(now);
  const currentPeriod = current.period;

  const keys: PlannerFortnightKey[] = paymentPlanFortnightKeys({
    now,
    dueDay,
    cutoffDay: card.cutoff_day,
  });

  const uniqueKeys = Array.from(
    new Map(keys.map((key) => [fortnightKey(key), key])).values(),
  );

  if (uniqueKeys.length === 0) {
    return [];
  }

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

  const [plans, fortnightPayments] = await Promise.all([
    prisma.creditCardPaymentPlan.findMany({
      where: {
        credit_card_wallet_id: walletId,
        ...ownerFilter,
      },
      select: planSelect,
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

  const storedWrites = plans.map((plan) => toStoredPaymentPlanWrite(plan));
  const paymentsByFortnight = new Map(
    fortnightPayments.map((row) => [row.fortnightId, row.total]),
  );

  const todayYmd = todayCalendarDate();

  const views = await Promise.all(
    fortnights.map(async (fortnight) => {
      const asOf = plannerAsOfForCardMonth({
        year: fortnight.year,
        month: fortnight.month,
        cutoffDay: card.cutoff_day!,
        dueDay,
      });
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
      const active = selectActivePlannedOverride(
        storedWrites,
        {
          statementEnd: formatCalendarDate(window.statementEnd),
          statementDueDate: formatCalendarDate(window.statementDueDate),
        },
        { cutoffDay: card.cutoff_day!, dueDay: card.due_day! },
      );
      const plannedGross = active.plannedOverride;
      const explicitZero = active.explicitZero;
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
          persistedMinimumPayment:
            card.minimum_payment == null ? null : Number(card.minimum_payment),
        },
        plannedGrossAmount: plannedGross,
        paymentsAppliedToFortnight,
        todayYmd,
        explicitZero,
      });

      const view = toCreditCardPaymentPlanView({
        fortnight,
        isCurrentFortnight:
          fortnight.year === current.year &&
          fortnight.month === current.month &&
          fortnight.period === currentPeriod,
        fields,
      });
      return {
        ...view,
        planScope: active.scope,
        planCycleCount: active.cycleCount,
        planValidUntil: active.validUntil,
      };
    }),
  );

  return views
    .filter(
      (view) =>
        !isStalePastDueGap({
          statementDueDate: view.statementDueDate,
          cutoffDay: card.cutoff_day!,
          dueDay,
          plannerStatus: view.plannerStatus,
          paymentsAppliedToStatement: view.paymentsAppliedToStatement,
          paymentsAppliedToFortnight: view.paymentsAppliedToFortnight,
          nextDuePayment: view.effectiveAmount,
          periodObligation: view.periodObligation,
          today: now,
        }),
    )
    .sort((a, b) => {
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
  const { year, month, period } = getCalendarFortnightRefForYmd(
    formatCalendarDate(asOf),
  );

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
  options?: UpsertCardPaymentPlanOptions,
) {
  const [fortnight, wallet] = await Promise.all([
    prisma.fortnight.findFirst({
      where: { id: fortnightId, ...ownerFilter },
      select: { id: true, year: true, month: true },
    }),
    prisma.wallet.findFirst({
      where: { id: walletId, ...ownerFilter, active: true },
      select: {
        id: true,
        type: true,
        amount: true,
        cutoff_day: true,
        due_day: true,
      },
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

  const declareZero = options?.declareZero === true;
  const scope = options?.scope ?? 'this_cycle';
  if (scope === 'n_cycles' && (options?.cycleCount == null || options.cycleCount < 1)) {
    const error = new Error('Indica cuántos cortes cubre el pago planeado.');
    (error as { code?: string }).code = 'SCOPE_INVALID';
    throw error;
  }
  if (scope === 'until_date' && !options?.validUntil) {
    const error = new Error('Indica la fecha hasta la que aplica el pago planeado.');
    (error as { code?: string }).code = 'SCOPE_INVALID';
    throw error;
  }
  const outstandingBalance = Number(wallet.amount);
  if (!declareZero && plannedAmount <= 0) {
    const error = new Error(
      'El monto planeado debe ser mayor a 0. Quita el monto planeado si no quieres un override.',
    );
    (error as { code?: string }).code = 'AMOUNT_INVALID';
    throw error;
  }
  if (!declareZero && plannedAmount > outstandingBalance) {
    const error = new Error(
      'El monto planeado no puede superar la deuda actual de la tarjeta',
    );
    (error as { code?: string }).code = 'AMOUNT_EXCEEDS_BALANCE';
    throw error;
  }

  const isUserContext = ownerFilter.user_id !== null;
  const storedAmount = declareZero ? 0 : plannedAmount;
  const anchorStatementEnd =
    wallet.cutoff_day != null && wallet.due_day != null
      ? parseDateOnly(
          statementCycleForMonth(
            fortnight.year,
            fortnight.month,
            wallet.cutoff_day,
            wallet.due_day,
          ).statementEnd,
        )
      : null;
  const scopeData = {
    scope: toPrismaScope(scope),
    cycle_count: scope === 'n_cycles' ? options?.cycleCount ?? null : null,
    valid_until:
      scope === 'until_date' && options?.validUntil
        ? parseDateOnly(options.validUntil)
        : null,
    anchor_statement_end: anchorStatementEnd,
  };

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
      planned_amount: storedAmount,
      declared_zero: declareZero,
      ...scopeData,
      user_id: isUserContext ? ownerFilter.user_id : null,
      house_id: !isUserContext ? ownerFilter.house_id : null,
    },
    update: {
      planned_amount: storedAmount,
      declared_zero: declareZero,
      ...scopeData,
    },
    select: {
      credit_card_wallet_id: true,
      fortnight_id: true,
      planned_amount: true,
      declared_zero: true,
      scope: true,
      cycle_count: true,
      valid_until: true,
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
    select: { id: true, year: true, month: true },
  });

  if (!fortnight) {
    const error = new Error('Quincena no encontrada');
    (error as { code?: string }).code = 'FORTNIGHT_NOT_FOUND';
    throw error;
  }

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, ...ownerFilter },
    select: { cutoff_day: true, due_day: true },
  });

  const plans = await prisma.creditCardPaymentPlan.findMany({
    where: {
      credit_card_wallet_id: walletId,
      ...ownerFilter,
    },
    select: planSelect,
  });

  if (wallet?.cutoff_day == null || wallet.due_day == null) {
    await prisma.creditCardPaymentPlan.deleteMany({
      where: {
        fortnight_id: fortnightId,
        credit_card_wallet_id: walletId,
        ...ownerFilter,
      },
    });
    return;
  }

  const target = statementCycleForMonth(
    fortnight.year,
    fortnight.month,
    wallet.cutoff_day,
    wallet.due_day,
  );
  const card = { cutoffDay: wallet.cutoff_day, dueDay: wallet.due_day };
  const ids = plans
    .filter((plan) => writeCoversCycle(toStoredPaymentPlanWrite(plan), target, card))
    .map((plan) => plan.id);

  await prisma.creditCardPaymentPlan.deleteMany({
    where: {
      credit_card_wallet_id: walletId,
      ...ownerFilter,
      ...(ids.length > 0 ? { id: { in: ids } } : { fortnight_id: fortnightId }),
    },
  });
}
