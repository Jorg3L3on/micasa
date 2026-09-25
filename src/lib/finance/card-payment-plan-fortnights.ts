import { formatCalendarDate } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/card-statement-obligation';
import {
  dueDayFallsInFortnight,
  getCalendarFortnightRefForYmd,
  getCurrentCalendarFortnightRef,
  getNextCalendarFortnight,
  type CalendarFortnightPeriod,
} from '@/lib/fortnight-calendar';

export type PaymentPlanFortnightKey = {
  year: number;
  month: number;
  period: CalendarFortnightPeriod;
};

const fortnightKey = (key: PaymentPlanFortnightKey) =>
  `${key.year}-${key.month}-${key.period}`;

/**
 * Fortnights the card plan can act on.
 * Current and next quincenas where the due day falls, plus the fortnight that
 * contains the open statement due date — even when that corte is already in
 * the previous quincena. Without the open corte, Capturar never reaches the
 * gap shown on the card.
 */
export const paymentPlanFortnightKeys = (input: {
  now: Date;
  dueDay: number;
  cutoffDay: number;
}): PaymentPlanFortnightKey[] => {
  const current = getCurrentCalendarFortnightRef(input.now);
  const next = getNextCalendarFortnight(input.now);
  const window = resolveCreditCardStatementWindow(
    input.now,
    input.cutoffDay,
    input.dueDay,
  );
  const statementDue = getCalendarFortnightRefForYmd(
    formatCalendarDate(window.statementDueDate),
  );
  const keys = [current, next].filter((key) =>
    dueDayFallsInFortnight(input.dueDay, key.year, key.month, key.period),
  );
  keys.push(statementDue);

  return Array.from(new Map(keys.map((key) => [fortnightKey(key), key])).values());
};
