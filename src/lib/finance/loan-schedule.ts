import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from '@/lib/calendar-dates';
import type {
  LoanPaymentFrequencyValue,
  LoanPaymentListItem,
  LoanStatusValue,
} from '@/types/loans';

export type GeneratedLoanPayment = {
  sequence: number;
  dueDate: Date;
  amount: number;
};

export function parseYmdAsUtcDate(value: string): Date {
  return parseCalendarDate(value);
}

export function formatDateYmd(value: Date): string {
  return formatCalendarDate(value);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsClamped(date: Date, months: number): Date {
  const [year, month, day] = formatCalendarDate(date).split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const lastDay = lastDayOfMonth(targetYear, normalizedMonth);
  const clampedDay = Math.min(day, lastDay);
  return parseCalendarDate(
    `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`,
  );
}

function addDays(date: Date, days: number): Date {
  return parseCalendarDate(addCalendarDays(formatCalendarDate(date), days));
}

/** 1ª-quincena anchor day (1–15) derived from the loan start date. */
export function getFortnightlyFirstAnchor(startDate: Date): number {
  const startDay = Number(formatCalendarDate(startDate).slice(8, 10));
  return startDay <= 15 ? startDay : startDay - 15;
}

/** 2ª-quincena anchor for a target month (16–last day). */
export function getFortnightlySecondAnchor(
  firstAnchor: number,
  year: number,
  month: number,
): number {
  const lastDay = lastDayOfMonth(year, month);
  if (firstAnchor === 15) return lastDay;
  return Math.min(firstAnchor + 15, lastDay);
}

/**
 * Calendar-quincena due date: one installment per app fortnight (1–15 / 16–end),
 * alternating anchors from the start date — not fixed +14-day intervals.
 */
export function dueDateForFortnightlyPayment(
  startDate: Date,
  index: number,
): Date {
  if (index === 0) return startDate;

  const [startYear, startMonth, startDay] = formatCalendarDate(startDate)
    .split('-')
    .map(Number);
  const firstAnchor = getFortnightlyFirstAnchor(startDate);
  const startInFirst = startDay <= 15;

  let targetMonth: number;
  let targetYear: number;
  let day: number;

  if (startInFirst) {
    const monthOffset = Math.floor(index / 2);
    const useSecondAnchor = index % 2 === 1;
    targetMonth = startMonth + monthOffset;
    targetYear = startYear + Math.floor((targetMonth - 1) / 12);
    targetMonth = ((targetMonth - 1) % 12) + 1;
    day = useSecondAnchor
      ? getFortnightlySecondAnchor(firstAnchor, targetYear, targetMonth)
      : firstAnchor;
  } else {
    const monthOffset = Math.floor((index + 1) / 2);
    const useFirstAnchor = index % 2 === 1;
    targetMonth = startMonth + monthOffset;
    targetYear = startYear + Math.floor((targetMonth - 1) / 12);
    targetMonth = ((targetMonth - 1) % 12) + 1;
    day = useFirstAnchor
      ? firstAnchor
      : getFortnightlySecondAnchor(firstAnchor, targetYear, targetMonth);
  }

  return parseCalendarDate(
    `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
}

function addFrequency(
  startDate: Date,
  frequency: LoanPaymentFrequencyValue,
  offset: number,
): Date {
  if (frequency === 'WEEKLY') {
    return addDays(startDate, offset * 7);
  }
  if (frequency === 'FORTNIGHTLY') {
    return dueDateForFortnightlyPayment(startDate, offset);
  }
  return addMonthsClamped(startDate, offset);
}

export function generateLoanPaymentSchedule(input: {
  startDate: Date;
  paymentAmount: number;
  paymentCount: number;
  frequency: LoanPaymentFrequencyValue;
}): GeneratedLoanPayment[] {
  return Array.from({ length: input.paymentCount }, (_, index) => ({
    sequence: index + 1,
    dueDate: addFrequency(input.startDate, input.frequency, index),
    amount: input.paymentAmount,
  }));
}

export function calculateLoanProgress(input: {
  principalAmount: number;
  payments: Pick<LoanPaymentListItem, 'amount' | 'status'>[];
}) {
  const paidPayments = input.payments.filter((p) => p.status === 'PAID');
  const paidAmount = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const payablePayments = input.payments.filter((p) => p.status !== 'CANCELLED');
  const scheduledPayable = payablePayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const totalPayable =
    input.payments.length > 0 ? scheduledPayable : input.principalAmount;
  const unresolvedPayments = input.payments.filter(
    (p) => p.status === 'SCHEDULED' || p.status === 'SKIPPED',
  );
  return {
    totalPayable,
    paidAmount,
    remainingAmount: Math.max(0, totalPayable - paidAmount),
    paidPayments: paidPayments.length,
    remainingPayments: unresolvedPayments.length,
  };
}

export function deriveLoanStatusFromPayments(
  payments: Pick<LoanPaymentListItem, 'status'>[],
): LoanStatusValue {
  const hasUnresolvedDebt = payments.some(
    (payment) =>
      payment.status === 'SCHEDULED' || payment.status === 'SKIPPED',
  );
  return hasUnresolvedDebt ? 'ACTIVE' : 'PAID_OFF';
}
