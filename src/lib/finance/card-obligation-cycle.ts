import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import { resolveCreditCardStatementWindow } from '@/lib/finance/card-statement-obligation';

const clampDayToMonth = (year: number, month: number, day: number) =>
  Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());

const createCalendarDate = (year: number, month: number, day: number) =>
  parseCalendarDate(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

/**
 * asOf that keeps this month's due date inside the statement window.
 * On a shared corte/pago day, asOf on the cutoff rolls the due into next month.
 */
export const asOfForDueInMonth = (
  year: number,
  month: number,
  cutoffDay: number,
  dueDay: number,
): Date => {
  const due = clampDayToMonth(year, month, dueDay);
  const asOfDay = cutoffDay === dueDay && due > 1 ? due - 1 : due;
  return createCalendarDate(year, month, asOfDay);
};

/** asOf for the corte whose due date falls in this calendar month. */
export const plannerAsOfForCardMonth = (input: {
  year: number;
  month: number;
  cutoffDay: number;
  dueDay: number;
  today?: Date;
}): Date => {
  void input.today;
  return asOfForDueInMonth(input.year, input.month, input.cutoffDay, input.dueDay);
};

/**
 * The corte is past due and statement/Liquidez have already moved to a later
 * open cycle. A missing figure on that old corte is a gap the other surfaces
 * do not show. Rows with a real amount or a recorded payment stay.
 */
export const isStalePastDueGap = (input: {
  statementDueDate: string;
  cutoffDay: number;
  dueDay: number;
  plannerStatus?: string | null;
  paymentsAppliedToStatement?: number;
  paymentsAppliedToFortnight?: number;
  nextDuePayment?: number;
  periodObligation?: { confidence?: string } | null;
  today?: Date;
}): boolean => {
  if (input.cutoffDay <= 0 || input.dueDay <= 0) return false;
  const today = input.today ?? new Date();
  const todayYmd = formatCalendarDate(today);
  if (input.statementDueDate >= todayYmd) return false;
  const liveDue = formatCalendarDate(
    resolveCreditCardStatementWindow(today, input.cutoffDay, input.dueDay)
      .statementDueDate,
  );
  if (liveDue <= input.statementDueDate) return false;
  if ((input.paymentsAppliedToStatement ?? 0) > 0) return false;
  if ((input.paymentsAppliedToFortnight ?? 0) > 0) return false;
  if ((input.nextDuePayment ?? 0) > 0 && input.plannerStatus !== 'falta_dato') {
    return false;
  }
  return (
    input.periodObligation?.confidence === 'missing' ||
    input.plannerStatus === 'falta_dato'
  );
};
