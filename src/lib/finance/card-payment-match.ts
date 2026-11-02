import { addCalendarDays, parseCalendarDate } from '@/lib/calendar-dates';

/** Days either side of the payment date a scheduled card row may be due. */
export const CARD_PAYMENT_MATCH_WINDOW_DAYS = 7;

/** `due_date` bounds for rows a card payment made on `paidAtYmd` may cover. */
export function cardPaymentMatchWindow(paidAtYmd: string): { gte: Date; lte: Date } {
  const ymd = paidAtYmd.slice(0, 10);
  return {
    gte: parseCalendarDate(addCalendarDays(ymd, -CARD_PAYMENT_MATCH_WINDOW_DAYS)),
    lte: parseCalendarDate(addCalendarDays(ymd, CARD_PAYMENT_MATCH_WINDOW_DAYS)),
  };
}

const toCents = (value: number) => Math.round(value * 100);

/**
 * Picks the row a card payment settles: the first row with the exact amount,
 * else the earliest row the payment fully covers (paying the whole statement
 * settles the cuota inside it). A payment smaller than every row settles none:
 * a partial abono must not mark an installment as paid.
 *
 * `candidates` must already be sorted by due date.
 */
export function pickCardPaymentMatch<T extends { amount: number }>(
  candidates: readonly T[],
  paymentAmount: number,
): T | null {
  const paid = toCents(paymentAmount);
  return (
    candidates.find((row) => toCents(row.amount) === paid) ??
    candidates.find((row) => toCents(row.amount) <= paid) ??
    null
  );
}
