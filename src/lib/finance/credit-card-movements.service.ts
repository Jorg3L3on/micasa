import {
  addCalendarDays,
  formatStoredDateOnly,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { listInstallmentPlansForCard } from '@/lib/finance/credit-card-installment-plan.service';
import { listScheduledPaymentsForCard } from '@/lib/finance/credit-card-scheduled-payment.service';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type CardMovementKind = 'purchase' | 'payment' | 'scheduled_payment' | 'installment';

export type CardMovement = {
  kind: CardMovementKind;
  id: number;
  date: string;
  description: string;
  amount: number;
};

export type CardMovementRange = {
  from?: string;
  to?: string;
  /** Use the current cutoff cycle instead of from/to. */
  useCurrentCycle?: boolean;
};

const DEFAULT_RANGE_DAYS = 30;

/**
 * Purchases, payments, uncovered scheduled payments and pending installment
 * payments of a card whose date falls in the range. Without from/to (or with
 * `useCurrentCycle`) the range is the current cutoff cycle; with only one end
 * it extends 30 days from it.
 */
export async function listCardMovementsForRange(
  cardId: number,
  ownerFilter: OwnerFilter,
  range: CardMovementRange,
): Promise<{ balance: number; from: string; to: string; movements: CardMovement[] }> {
  const statement = await getCreditCardStatementByOwner(cardId, ownerFilter);

  let { from, to } = range;
  if (range.useCurrentCycle || (!from && !to)) {
    from = formatStoredDateOnly(statement.current_cycle_start);
    to = formatStoredDateOnly(statement.current_cycle_end);
  } else if (!to) {
    to = todayCalendarDate();
  } else if (!from) {
    from = addCalendarDays(to, -(DEFAULT_RANGE_DAYS - 1));
  }
  const rangeFrom = from!;
  const rangeTo = to!;
  const inRange = (ymd: string) => ymd >= rangeFrom && ymd <= rangeTo;

  const [scheduledPayments, installmentPlans] = await Promise.all([
    listScheduledPaymentsForCard(cardId, ownerFilter),
    listInstallmentPlansForCard(cardId, ownerFilter),
  ]);

  // The same purchase can show up in the statement, the current cycle and the
  // active-installment list; keep one row per id.
  const purchases = new Map<number, (typeof statement.statement_purchases)[number]>();
  for (const purchase of [
    ...statement.statement_purchases,
    ...statement.current_cycle_purchase_items,
    ...statement.installment_active_purchases,
  ]) {
    if (inRange(formatStoredDateOnly(purchase.payment_date))) {
      purchases.set(purchase.id, purchase);
    }
  }

  const movements: CardMovement[] = [
    ...[...purchases.values()].map((purchase) => ({
      kind: 'purchase' as const,
      id: purchase.id,
      date: formatStoredDateOnly(purchase.payment_date),
      description: purchase.description,
      amount: purchase.amount,
    })),
    ...statement.payment_history
      .filter((payment) => inRange(formatStoredDateOnly(payment.paid_at)))
      .map((payment) => ({
        kind: 'payment' as const,
        id: payment.id,
        date: formatStoredDateOnly(payment.paid_at),
        description: payment.note ?? `Pago ${payment.source_wallet_name}`,
        amount: payment.amount,
      })),
    ...scheduledPayments
      .filter((row) => row.status === 'SCHEDULED' && inRange(formatStoredDateOnly(row.dueDate)))
      .map((row) => ({
        kind: 'scheduled_payment' as const,
        id: row.id,
        date: formatStoredDateOnly(row.dueDate),
        description: row.label ?? 'Cuota programada',
        amount: row.amount,
      })),
    ...installmentPlans.flatMap((plan) =>
      plan.payments
        .filter(
          (payment) =>
            payment.status === 'SCHEDULED' && inRange(formatStoredDateOnly(payment.dueDate)),
        )
        .map((payment) => ({
          kind: 'installment' as const,
          id: payment.id,
          date: formatStoredDateOnly(payment.dueDate),
          description: `${plan.name} (${payment.sequence}/${plan.totalInstallments})`,
          amount: payment.amount,
        })),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { balance: statement.outstanding_balance, from: rangeFrom, to: rangeTo, movements };
}
