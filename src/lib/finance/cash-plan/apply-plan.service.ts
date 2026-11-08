import prisma from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatCalendarDate } from '@/lib/calendar-dates';
import { getCalendarFortnightRefForYmd, getFortnightYmdBounds, shiftCalendarMonth } from '@/lib/fortnight-calendar';
import { resolveOrCreateFortnight } from '@/lib/fortnights';
import { upsertCreditCardPaymentPlan } from '@/lib/finance/credit-card-payment-plan.service';
import { createExpense, updateExpense } from '@/lib/finance/expense.service';
import {
  collectCardPlans,
  collectLoanAbonos,
  noWriteReason,
  type AppliedWrite,
  type ApplyPlanResult,
  type SkippedAction,
} from '@/lib/finance/cash-plan/apply-plan-mapping';

export type { AppliedWrite, ApplyPlanResult, SkippedAction };
import { fromCents, toCents } from '@/lib/finance/cash-plan/money';
import type { ActionInstance, Obligation } from '@/lib/finance/cash-plan/types';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { LiquidityProjectionResponse } from '@/types/catalog';

export type ApplyPlanInput = {
  ownerFilter: OwnerFilter;
  /** The chosen route's steps, as the server recomputed them. */
  actions: readonly ActionInstance[];
  obligations: readonly Obligation[];
  projection: Pick<LiquidityProjectionResponse, 'milestones'>;
};

/** Expense ids behind a bill obligation, from the projection rows it was built from. */
export const expenseIdsForObligation = (
  obligationId: string,
  projection: Pick<LiquidityProjectionResponse, 'milestones'>,
): number[] => {
  const ids = new Set<number>();
  for (const milestone of projection.milestones) {
    for (const item of milestone.obligations) {
      if (item.source !== 'unpaid_expense' || item.expense_id == null) continue;
      const label = item.template_name || item.expense_description || item.wallet_name || 'Gasto';
      if (`bill-${item.expense_template_id ?? item.expense_id ?? label}` === obligationId) ids.add(item.expense_id);
    }
  }
  return [...ids];
};

const nextFortnightRef = (year: number, month: number, period: 'FIRST' | 'SECOND') => {
  if (period === 'FIRST') return { year, month, period: 'SECOND' as const };
  const next = shiftCalendarMonth(year, month, 1);
  return { year: next.year, month: next.month, period: 'FIRST' as const };
};

/**
 * "Activar este plan": turns each step of the chosen route into a write on
 * an existing model, or reports why it writes nothing. Card steps upsert one
 * CreditCardPaymentPlan per card and quincena; a deferral moves an unpaid
 * expense to the next quincena. Idempotent: a plan row that already has the
 * amount is reported, not rewritten. Must run inside an audit actor scope.
 */
const ownerOf = (ownerFilter: OwnerFilter) => ({
  ownerType: ownerFilter.user_id != null ? ('user' as const) : ('house' as const),
  ownerId: (ownerFilter.user_id ?? ownerFilter.house_id)!,
});

/** The quincena that holds a civil day, created the way the Panel creates it when missing. */
const fortnightForDate = async (ownerFilter: OwnerFilter, ymd: string) => {
  const ref = getCalendarFortnightRefForYmd(ymd);
  return resolveOrCreateFortnight({ ...ownerOf(ownerFilter), year: ref.year, month: ref.month, period: ref.period });
};

export async function applyCashPlan(input: ApplyPlanInput): Promise<ApplyPlanResult> {
  const { ownerFilter, actions, obligations, projection } = input;
  const writes: AppliedWrite[] = [];
  const skipped: SkippedAction[] = [];
  const skip = (step: Pick<ActionInstance, 'type' | 'label'>, reason: string) =>
    skipped.push({ type: step.type, label: step.label, reason });

  for (const step of actions) {
    const reason = noWriteReason(step);
    if (reason) skip(step, reason);
  }

  for (const plan of collectCardPlans(actions, obligations)) {
    const step = { type: 'pay_statement' as const, label: plan.label };
    const wallet = await prisma.wallet.findFirst({
      where: { id: plan.walletId, ...ownerFilter, active: true },
      select: { amount: true },
    });
    if (!wallet) {
      skip(step, 'Tarjeta no encontrada.');
      continue;
    }
    // A payment never goes above what the card owes; the rest stays in cash.
    const debtCents = toCents(Number(wallet.amount));
    const plannedCents = Math.min(plan.amountCents, debtCents);
    if (plannedCents <= 0) {
      skip(step, 'La tarjeta no tiene deuda registrada.');
      continue;
    }
    if (plannedCents < (plan.uncappedCents ?? plan.amountCents)) {
      skip(step, `La tarjeta queda en $0 con ${formatMoney(fromCents(plannedCents))}; el resto se queda en tu cuenta.`);
    }
    // Undated: this quincena, the one the plan is about.
    const fortnightId = (await fortnightForDate(ownerFilter, plan.dueDate ?? formatCalendarDate(new Date()))).id;
    const amount = fromCents(plannedCents);
    const existing = await prisma.creditCardPaymentPlan.findUnique({
      where: { credit_card_wallet_id_fortnight_id: { credit_card_wallet_id: plan.walletId, fortnight_id: fortnightId } },
      select: { planned_amount: true, declared_zero: true },
    });
    if (existing && !existing.declared_zero && toCents(Number(existing.planned_amount)) === plannedCents) {
      writes.push({ kind: 'card_payment_plan', walletId: plan.walletId, label: plan.label, fortnightId, amount, status: 'unchanged' });
      continue;
    }
    await upsertCreditCardPaymentPlan(ownerFilter, fortnightId, plan.walletId, amount);
    writes.push({
      kind: 'card_payment_plan',
      walletId: plan.walletId,
      label: plan.label,
      fortnightId,
      amount,
      status: existing ? 'updated' : 'created',
    });
  }

  for (const abono of collectLoanAbonos(actions, obligations)) {
    const step = { type: 'extra_to_debt_avalanche' as const, label: abono.label };
    const loan = await prisma.loan.findFirst({
      where: { id: abono.loanId, ...ownerFilter },
      select: { id: true },
    });
    if (!loan) {
      skip(step, 'Préstamo no encontrado.');
      continue;
    }
    const dueYmd = abono.dueDate ?? formatCalendarDate(new Date());
    const fortnight = await fortnightForDate(ownerFilter, dueYmd);
    const amount = fromCents(abono.amountCents);
    const existing = await prisma.expense.findFirst({
      where: {
        ...ownerFilter,
        fortnight_id: fortnight.id,
        description: abono.description,
        loan_payment_id: null,
        is_paid: false,
      },
      select: { id: true, amount: true },
    });
    if (existing && toCents(Number(existing.amount)) === abono.amountCents) {
      writes.push({ kind: 'loan_abono_planned', loanId: abono.loanId, label: abono.label, fortnightId: fortnight.id, expenseId: existing.id, amount, status: 'unchanged' });
      continue;
    }
    if (existing) {
      await updateExpense({ id: existing.id, ownerFilter, amount });
      writes.push({ kind: 'loan_abono_planned', loanId: abono.loanId, label: abono.label, fortnightId: fortnight.id, expenseId: existing.id, amount, status: 'updated' });
      continue;
    }
    const created = await createExpense({
      fortnightId: fortnight.id,
      categoryId: null,
      description: abono.description,
      amount,
      isPaid: false,
      paymentDate: abono.dueDate ?? null,
      walletId: abono.fromWalletId ?? null,
    });
    writes.push({ kind: 'loan_abono_planned', loanId: abono.loanId, label: abono.label, fortnightId: fortnight.id, expenseId: created.id, amount, status: 'created' });
  }

  for (const step of actions) {
    if (step.type !== 'defer_nonessential') continue;
    const expenseIds = step.obligationId ? expenseIdsForObligation(step.obligationId, projection) : [];
    if (expenseIds.length === 0) {
      skip(step, 'No es un gasto registrado; muévelo desde su plantilla.');
      continue;
    }
    for (const expenseId of expenseIds) {
      const expense = await prisma.expense.findFirst({
        where: { id: expenseId, ...ownerFilter },
        select: {
          id: true,
          description: true,
          is_paid: true,
          payment_date: true,
          fortnight: { select: { id: true, year: true, month: true, period: true } },
        },
      });
      if (!expense) {
        skip(step, 'Gasto no encontrado.');
        continue;
      }
      if (expense.is_paid) {
        skip(step, 'Ese gasto ya está pagado; no se mueve.');
        continue;
      }
      const next = nextFortnightRef(expense.fortnight.year, expense.fortnight.month, expense.fortnight.period);
      const target = await resolveOrCreateFortnight({
        ...ownerOf(ownerFilter),
        year: next.year,
        month: next.month,
        period: next.period,
      });
      if (target.id === expense.fortnight.id) {
        skip(step, 'Ya está en la siguiente quincena.');
        continue;
      }
      const { startYmd } = getFortnightYmdBounds(next.year, next.month, next.period);
      const keepsDate = expense.payment_date == null || formatCalendarDate(expense.payment_date) >= startYmd;
      await updateExpense({
        id: expense.id,
        ownerFilter,
        fortnightId: target.id,
        ...(keepsDate ? {} : { paymentDate: startYmd }),
      });
      writes.push({
        kind: 'expense_moved',
        expenseId: expense.id,
        label: expense.description ?? step.label,
        fromFortnightId: expense.fortnight.id,
        toFortnightId: target.id,
      });
    }
  }

  return { writes, skipped };
}
