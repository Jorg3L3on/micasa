import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/card-statement-obligation';

/**
 * Statement a charge on `chargeYmd` is billed on: a charge on the cutoff day
 * closes with that statement, a later one waits for the next cutoff. Pure, so
 * the browser can use it too (Simular compra).
 */
export const cardStatementForCharge = (chargeYmd: string, cutoffDay: number, dueDay: number) => {
  const window = resolveCreditCardStatementWindow(parseCalendarDate(chargeYmd), cutoffDay, dueDay);
  const billed =
    formatCalendarDate(window.statementEnd) === chargeYmd
      ? window
      : resolveCreditCardStatementWindow(window.currentCycleEnd, cutoffDay, dueDay);
  return {
    statementStart: formatCalendarDate(billed.statementStart),
    statementEnd: formatCalendarDate(billed.statementEnd),
    dueDate: formatCalendarDate(billed.statementDueDate),
  };
};
