/**
 * One-shot realignment to payday-aligned quincenas:
 * FIRST = last day of previous month through the 14th
 * SECOND = 15th through the penultimate day
 * Last day of the month belongs to next month's FIRST.
 *
 * 1. Rewrite Fortnight start_date / end_date from canonical bounds
 * 2. Reassign Expense / Income rows whose civil date no longer sits in
 *    their current named quincena
 * 3. Merge CreditCardPaymentPlan collisions if a plan's fortnight is
 *    deleted... (plans stay on named fortnights; dates only change)
 * 4. Regenerate budget periods for affected owner-months
 */
import { formatCalendarDate } from '../src/lib/calendar-dates';
import { getCalendarFortnightRefForYmd } from '../src/lib/fortnight-calendar';
import { getCanonicalFortnightBounds } from '../src/lib/finance/budget-period-windows';
import { generatePeriodsForMonth } from '../src/lib/finance/budget-period.service';
import { resolveOrCreateFortnight } from '../src/lib/fortnights';
import prisma from '../src/lib/prisma';
import type { OwnerFilter } from '../src/lib/server/get-owner-context';

const ownerFromRow = (
  userId: number | null,
  houseId: number | null,
): { ownerType: 'user' | 'house'; ownerId: number; ownerFilter: OwnerFilter } => {
  if (userId != null) {
    return {
      ownerType: 'user',
      ownerId: userId,
      ownerFilter: { user_id: userId, house_id: null },
    };
  }
  if (houseId != null) {
    return {
      ownerType: 'house',
      ownerId: houseId,
      ownerFilter: { user_id: null, house_id: houseId },
    };
  }
  throw new Error('Row is missing owner');
};

async function main() {
  const fortnights = await prisma.fortnight.findMany({
    select: {
      id: true,
      year: true,
      month: true,
      period: true,
      user_id: true,
      house_id: true,
    },
  });

  let fortnightsUpdated = 0;
  const monthsToRegen = new Map<
    string,
    { ownerFilter: OwnerFilter; year: number; month: number }
  >();

  for (const fn of fortnights) {
    const bounds = getCanonicalFortnightBounds(fn.year, fn.month, fn.period);
    await prisma.fortnight.update({
      where: { id: fn.id },
      data: {
        start_date: bounds.start_date,
        end_date: bounds.end_date,
      },
    });
    fortnightsUpdated += 1;
    const { ownerFilter } = ownerFromRow(fn.user_id, fn.house_id);
    monthsToRegen.set(`${fn.user_id ?? 'h'}-${fn.house_id ?? 'u'}-${fn.year}-${fn.month}`, {
      ownerFilter,
      year: fn.year,
      month: fn.month,
    });
  }

  console.log(`Updated ${fortnightsUpdated} fortnight date range(s).`);

  const expenses = await prisma.expense.findMany({
    select: {
      id: true,
      fortnight_id: true,
      payment_date: true,
      created_at: true,
      user_id: true,
      house_id: true,
    },
  });

  let expensesMoved = 0;
  for (const expense of expenses) {
    const ymd = formatCalendarDate(expense.payment_date ?? expense.created_at);
    const ref = getCalendarFortnightRefForYmd(ymd);
    const { ownerType, ownerId } = ownerFromRow(expense.user_id, expense.house_id);
    const target = await resolveOrCreateFortnight({
      ownerType,
      ownerId,
      year: ref.year,
      month: ref.month,
      period: ref.period,
    });
    if (target.id === expense.fortnight_id) continue;
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        fortnight_id: target.id,
        user_id: target.user_id,
        house_id: target.house_id,
      },
    });
    expensesMoved += 1;
    monthsToRegen.set(
      `${target.user_id ?? 'h'}-${target.house_id ?? 'u'}-${target.year}-${target.month}`,
      {
        ownerFilter: ownerFromRow(target.user_id, target.house_id).ownerFilter,
        year: target.year,
        month: target.month,
      },
    );
  }

  console.log(`Reassigned ${expensesMoved} expense(s).`);

  const incomes = await prisma.income.findMany({
    select: {
      id: true,
      fortnight_id: true,
      received_at: true,
      user_id: true,
      house_id: true,
    },
  });

  let incomesMoved = 0;
  for (const income of incomes) {
    const ymd = formatCalendarDate(income.received_at);
    const ref = getCalendarFortnightRefForYmd(ymd);
    const { ownerType, ownerId } = ownerFromRow(income.user_id, income.house_id);
    const target = await resolveOrCreateFortnight({
      ownerType,
      ownerId,
      year: ref.year,
      month: ref.month,
      period: ref.period,
    });
    if (target.id === income.fortnight_id) continue;
    await prisma.income.update({
      where: { id: income.id },
      data: {
        fortnight_id: target.id,
        user_id: target.user_id,
        house_id: target.house_id,
      },
    });
    incomesMoved += 1;
  }

  console.log(`Reassigned ${incomesMoved} income(s).`);

  const plans = await prisma.creditCardPaymentPlan.findMany({
    select: {
      id: true,
      credit_card_wallet_id: true,
      fortnight_id: true,
      planned_amount: true,
    },
  });

  const seen = new Map<string, { id: number; planned_amount: number }>();
  let plansMerged = 0;
  for (const plan of plans) {
    const key = `${plan.credit_card_wallet_id}-${plan.fortnight_id}`;
    const amount = Number(plan.planned_amount);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { id: plan.id, planned_amount: amount });
      continue;
    }
    const keepId =
      amount > existing.planned_amount ? plan.id : existing.id;
    const dropId = keepId === plan.id ? existing.id : plan.id;
    if (keepId === plan.id) {
      seen.set(key, { id: plan.id, planned_amount: amount });
    }
    await prisma.creditCardPaymentPlan.delete({ where: { id: dropId } });
    plansMerged += 1;
  }

  console.log(`Merged ${plansMerged} duplicate card payment plan(s).`);

  let periodsRegen = 0;
  for (const { ownerFilter, year, month } of monthsToRegen.values()) {
    const result = await generatePeriodsForMonth(year, month, ownerFilter);
    periodsRegen += result.total;
  }

  console.log(`Regenerated budget periods (total windows touched: ${periodsRegen}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
