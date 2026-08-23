import {
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';

export type GeneratedInstallmentPlanPayment = {
  sequence: number;
  dueDate: Date;
  amount: number;
  status: 'SCHEDULED' | 'PAID';
};

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsClamped(date: Date, months: number): Date {
  const [year, month, day] = formatCalendarDate(date).split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const clampedDay = Math.min(day, lastDayOfMonth(targetYear, normalizedMonth));
  return parseCalendarDate(
    `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`,
  );
}

/** Default first due date: card due_day in current or next month. */
export const defaultNextDueDateForCard = (
  dueDay: number,
  asOfYmd: string = todayCalendarDate(),
): string => {
  const [year, month, day] = asOfYmd.split('-').map(Number);
  const clampedDay = Math.min(dueDay, lastDayOfMonth(year, month));
  if (day <= clampedDay) {
    return `${year}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }
  const next = addMonthsClamped(parseCalendarDate(asOfYmd), 1);
  const [ny, nm] = formatCalendarDate(next).split('-').map(Number);
  const nextClamped = Math.min(dueDay, lastDayOfMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nextClamped).padStart(2, '0')}`;
};

export const generateInstallmentPlanPayments = (input: {
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  nextDueDate: string;
}): GeneratedInstallmentPlanPayment[] => {
  const firstDue = parseCalendarDate(input.nextDueDate);

  return Array.from({ length: input.totalInstallments }, (_, index) => {
    const sequence = index + 1;
    const isPaid = sequence <= input.paidInstallments;
    const monthOffset = sequence - (input.paidInstallments + 1);

    return {
      sequence,
      dueDate: addMonthsClamped(firstDue, monthOffset),
      amount: input.installmentAmount,
      status: isPaid ? 'PAID' : 'SCHEDULED',
    };
  });
};

export const formatPlanEndMonthLabel = (endDateYmd: string): string => {
  const [year, month] = endDateYmd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('es-MX', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
