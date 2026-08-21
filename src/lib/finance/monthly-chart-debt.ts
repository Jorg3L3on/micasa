import { formatCalendarDate } from '@/lib/calendar-dates';

export const calendarMonthKeyFromDate = (date: Date): string =>
  formatCalendarDate(date).slice(0, 7);

type PastLoanPayment = {
  status: string;
  paid_at: Date | null;
  due_date: Date;
  payment_source: string;
};

/**
 * Past liquidity chart: only loan and payroll debt, not rent/subscriptions.
 * PAID wallet loans use paid_at; payroll cuotas use due_date.
 */
export const pastDebtDateForLoanPayment = (payment: PastLoanPayment): Date | null => {
  if (payment.status === 'SKIPPED' || payment.status === 'CANCELLED') return null;
  if (payment.status === 'PAID' && payment.paid_at) return payment.paid_at;
  if (payment.payment_source === 'PAYROLL_DEDUCTION') return payment.due_date;
  return null;
};
