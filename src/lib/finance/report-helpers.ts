import type { Prisma } from '@/generated/prisma/client';
import { FortnightPeriod } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

const FORTNIGHT_PERIOD_ERROR = 'period must be FIRST or SECOND';

/**
 * Shared check for `?period=`. Parsing stays in `parseFortnightPeriod`.
 * A missing param is never an error. Blank is an error only when `blankIsError`.
 */
const fortnightPeriodParamErrorFor = (
  period: string | null | undefined,
  blankIsError: boolean,
): string | null => {
  if (period == null) return null;
  if (!blankIsError && period.trim() === '') return null;
  if (!parseFortnightPeriod(period)) return FORTNIGHT_PERIOD_ERROR;
  return null;
};

/** Optional period: missing or blank means all periods. Garbage is a client error. */
export const fortnightPeriodParamError = (
  period: string | null | undefined,
): string | null => fortnightPeriodParamErrorFor(period, false);

/**
 * Present period must parse. Blank and garbage are client errors.
 * A missing param still means the unfiltered catalog.
 */
export const strictFortnightPeriodParamError = (
  period: string | null | undefined,
): string | null => fortnightPeriodParamErrorFor(period, true);

export const parseFortnightPeriod = (
  value: string | null | undefined,
): FortnightPeriod | undefined => {
  const normalized = value?.trim().toUpperCase();
  if (normalized === FortnightPeriod.FIRST || normalized === '1') {
    return FortnightPeriod.FIRST;
  }
  if (normalized === FortnightPeriod.SECOND || normalized === '2') {
    return FortnightPeriod.SECOND;
  }
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

/** Same rolling calendar window as liquidity monthly-summary (oldest month first). */
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
