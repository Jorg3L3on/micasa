import prisma from '@/lib/prisma';
import {
  formatCalendarDate,
  todayCalendarDate,
  ymdForDayInMonth,
} from '@/lib/calendar-dates';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

/**
 * "Últimos generados" (MIC-I16-5): the last records a gasto or ingreso
 * programado created, newest quincena first. Read-only; scoped to the active
 * owner on both the item and the records.
 */

export type ScheduledHistoryKind = 'expense' | 'income';

export type ScheduledHistoryStatus =
  | 'paid'
  | 'pending'
  | 'overdue'
  | 'received'
  | 'expected';

export type ScheduledHistoryEntry = {
  id: number;
  period: 'FIRST' | 'SECOND';
  month: number;
  year: number;
  amount: number;
  status: ScheduledHistoryStatus;
};

export const SCHEDULED_HISTORY_LIMIT = 3;

type FortnightRef = {
  month: number;
  year: number;
  period: 'FIRST' | 'SECOND';
  end_date: Date;
};

/**
 * Civil day an expense is due: its own day in the quincena's month (clamped
 * to the month's last day), or the quincena's last day when it has none.
 */
export const expenseDueYmd = (
  dueDay: number | null,
  fortnight: FortnightRef,
): string => {
  if (dueDay !== null && dueDay > 0) {
    const monthKey = `${fortnight.year}-${String(fortnight.month).padStart(2, '0')}`;
    const ymd = ymdForDayInMonth(monthKey, dueDay);
    if (ymd) return ymd;
  }
  return formatCalendarDate(fortnight.end_date);
};

/** Pagado when paid; Vencido when unpaid and its day has passed; else Pendiente. */
export const expenseHistoryStatus = (
  isPaid: boolean,
  dueYmd: string,
  todayYmd: string,
): ScheduledHistoryStatus => {
  if (isPaid) return 'paid';
  return dueYmd < todayYmd ? 'overdue' : 'pending';
};

/** Recibido once the amount reached the wallet; Por recibir before. */
export const incomeHistoryStatus = (walletCredited: boolean): ScheduledHistoryStatus =>
  walletCredited ? 'received' : 'expected';

const FORTNIGHT_SELECT = {
  month: true,
  year: true,
  period: true,
  end_date: true,
} as const;

// Newest quincena first: SECOND sorts after FIRST in the enum.
const NEWEST_FIRST = [
  { fortnight: { year: 'desc' as const } },
  { fortnight: { month: 'desc' as const } },
  { fortnight: { period: 'desc' as const } },
  { id: 'desc' as const },
];

/**
 * Last `SCHEDULED_HISTORY_LIMIT` records created from one scheduled item of
 * the owner. Null when the item is not the owner's (the route answers 404).
 */
export async function listScheduledHistoryForOwner(
  ownerFilter: OwnerFilter,
  kind: ScheduledHistoryKind,
  templateId: number,
  now: Date = new Date(),
): Promise<ScheduledHistoryEntry[] | null> {
  if (kind === 'expense') {
    const template = await prisma.expenseTemplate.findFirst({
      where: { id: templateId, ...ownerFilter },
      select: { id: true },
    });
    if (!template) return null;
    const expenses = await prisma.expense.findMany({
      where: { expense_template_id: templateId, ...ownerFilter },
      select: {
        id: true,
        amount: true,
        is_paid: true,
        due_day: true,
        fortnight: { select: FORTNIGHT_SELECT },
      },
      orderBy: NEWEST_FIRST,
      take: SCHEDULED_HISTORY_LIMIT,
    });
    const today = todayCalendarDate(now);
    return expenses.map((expense) => ({
      id: expense.id,
      period: expense.fortnight.period,
      month: expense.fortnight.month,
      year: expense.fortnight.year,
      amount: Number(expense.amount),
      status: expenseHistoryStatus(
        expense.is_paid,
        expenseDueYmd(expense.due_day, expense.fortnight),
        today,
      ),
    }));
  }

  const template = await prisma.incomeTemplate.findFirst({
    where: { id: templateId, ...ownerFilter },
    select: { id: true },
  });
  if (!template) return null;
  const incomes = await prisma.income.findMany({
    where: { income_template_id: templateId, ...ownerFilter },
    select: {
      id: true,
      amount: true,
      wallet_credited: true,
      fortnight: { select: FORTNIGHT_SELECT },
    },
    orderBy: NEWEST_FIRST,
    take: SCHEDULED_HISTORY_LIMIT,
  });
  return incomes.map((income) => ({
    id: income.id,
    period: income.fortnight.period,
    month: income.fortnight.month,
    year: income.fortnight.year,
    amount: Number(income.amount),
    status: incomeHistoryStatus(income.wallet_credited),
  }));
}
