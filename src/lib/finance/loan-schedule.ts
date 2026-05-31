import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from '@/lib/calendar-dates';
import type {
  LoanPaymentFrequencyValue,
  LoanPaymentListItem,
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

function addMonthsClamped(date: Date, months: number): Date {
  const [year, month, day] = formatCalendarDate(date).split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  return parseCalendarDate(
    `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`,
  );
}

function addDays(date: Date, days: number): Date {
  return parseCalendarDate(addCalendarDays(formatCalendarDate(date), days));
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
    return addDays(startDate, offset * 14);
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
  const scheduledPayable = input.payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const totalPayable = scheduledPayable > 0 ? scheduledPayable : input.principalAmount;
  return {
    totalPayable,
    paidAmount,
    remainingAmount: Math.max(0, totalPayable - paidAmount),
    paidPayments: paidPayments.length,
    remainingPayments: input.payments.filter((p) => p.status === 'SCHEDULED')
      .length,
  };
}
