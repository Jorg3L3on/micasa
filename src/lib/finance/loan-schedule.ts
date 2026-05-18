import type {
  LoanPaymentFrequencyValue,
  LoanPaymentListItem,
} from '@/types/loans';

export type GeneratedLoanPayment = {
  sequence: number;
  dueDate: Date;
  amount: number;
};

const MS_PER_DAY = 86_400_000;

export function parseYmdAsUtcDate(value: string): Date {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateYmd(value: Date): string {
  return value.toISOString().split('T')[0];
}

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function addFrequency(
  startDate: Date,
  frequency: LoanPaymentFrequencyValue,
  offset: number,
): Date {
  if (frequency === 'WEEKLY') {
    return new Date(startDate.getTime() + offset * 7 * MS_PER_DAY);
  }
  if (frequency === 'FORTNIGHTLY') {
    return new Date(startDate.getTime() + offset * 14 * MS_PER_DAY);
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
