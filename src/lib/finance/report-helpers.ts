import type { Prisma } from '@/generated/prisma/client';
import { FortnightPeriod } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export const parseFortnightPeriod = (
  value: string | null | undefined,
): FortnightPeriod | undefined => {
  if (value === FortnightPeriod.FIRST) return FortnightPeriod.FIRST;
  if (value === FortnightPeriod.SECOND) return FortnightPeriod.SECOND;
  return undefined;
};

export const buildExpenseWhereForFortnightIds = (
  ownerFilter: OwnerFilter,
  fortnightIds: number[],
): Prisma.ExpenseWhereInput => ({
  ...ownerFilter,
  fortnight_id: { in: fortnightIds.length > 0 ? fortnightIds : [] },
});

export const buildExpenseWhereForFortnightScope = async (
  ownerFilter: OwnerFilter,
  month?: string | null,
  year?: string | null,
  period?: string | null,
  resolvedFortnightIds?: number[],
): Promise<Prisma.ExpenseWhereInput> => {
  const where: Prisma.ExpenseWhereInput = { ...ownerFilter };
  if (resolvedFortnightIds !== undefined) {
    return buildExpenseWhereForFortnightIds(ownerFilter, resolvedFortnightIds);
  }
  if (month || year || period) {
    const fortnightWhere: Prisma.FortnightWhereInput = { ...ownerFilter };
    const parsedPeriod = parseFortnightPeriod(period);
    if (month) {
      fortnightWhere.month = parseInt(month, 10);
    }
    if (year) {
      fortnightWhere.year = parseInt(year, 10);
    }
    if (parsedPeriod) {
      fortnightWhere.period = parsedPeriod;
    }

    const fortnights = await prisma.fortnight.findMany({
      where: fortnightWhere,
      select: { id: true },
    });

    const fortnightIds = fortnights.map((f) => f.id);
    if (fortnightIds.length > 0) {
      where.fortnight_id = { in: fortnightIds };
    } else {
      where.fortnight_id = { in: [] };
    }
  }
  return where;
};

/** Same rolling calendar window as dashboard monthly-summary (oldest month first). */
export const fortnightIdsForRollingCalendarMonths = async (
  ownerFilter: OwnerFilter,
  windowMonths: number,
): Promise<number[]> => {
  if (windowMonths < 1 || windowMonths > 120) {
    return [];
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const months: { year: number; month: number }[] = [];
  for (let i = windowMonths - 1; i >= 0; i--) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push({ year: y, month: m });
  }
  const yearMonthConditions = months.map(({ year, month }) => ({ year, month }));
  const fortnights = await prisma.fortnight.findMany({
    where: {
      ...ownerFilter,
      OR: yearMonthConditions,
    },
    select: { id: true },
  });
  return fortnights.map((f) => f.id);
};
