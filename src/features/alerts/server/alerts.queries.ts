import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { Prisma } from '@/generated/prisma/client';

export const fetchFortnightsCurrent = async (
  where: Prisma.FortnightWhereInput,
) =>
  prisma.fortnight.findMany({
    where,
    select: {
      id: true,
      start_date: true,
      end_date: true,
      month: true,
      year: true,
      period: true,
    },
  });

/** Expenses for alert totals + overdue (amount, paid, due day, fortnight). */
export const fetchAlertExpenses = async (where: Prisma.ExpenseWhereInput) =>
  prisma.expense.findMany({
    where,
    select: {
      amount: true,
      is_paid: true,
      due_day: true,
      fortnight: {
        select: {
          month: true,
          year: true,
        },
      },
    },
  });

export const fetchIncomeCurrent = async (
  ownerFilter: OwnerFilter,
  fortnightIds: number[],
) =>
  prisma.income.findMany({
    where: {
      ...ownerFilter,
      fortnight_id: { in: fortnightIds },
    },
    select: { amount: true, source: true },
  });
