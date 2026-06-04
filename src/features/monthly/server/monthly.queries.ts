import type { FortnightPeriod } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type FortnightNavInfo = {
  label: string;
  id: number;
  period: FortnightPeriod;
};

export type FortnightCalendarKey = {
  year: number;
  month: number;
  period: FortnightPeriod;
};

export const fortnightCalendarKey = ({
  year,
  month,
  period,
}: FortnightCalendarKey): string => `${year}-${month}-${period}`;

export const findFortnightsForCalendarKeys = async (
  ownerFilter: OwnerFilter,
  keys: FortnightCalendarKey[],
): Promise<Map<string, FortnightNavInfo>> => {
  const result = new Map<string, FortnightNavInfo>();
  if (keys.length === 0) return result;

  const fortnights = await prisma.fortnight.findMany({
    where: {
      ...ownerFilter,
      OR: keys.map((key) => ({
        year: key.year,
        month: key.month,
        period: key.period,
      })),
    },
    select: {
      id: true,
      label: true,
      year: true,
      month: true,
      period: true,
    },
  });

  for (const row of fortnights) {
    result.set(
      fortnightCalendarKey({
        year: row.year,
        month: row.month,
        period: row.period,
      }),
      {
        id: row.id,
        label: row.label,
        period: row.period,
      },
    );
  }

  return result;
};

export const findFortnightByCalendarPeriod = async (
  ownerFilter: OwnerFilter,
  year: number,
  month: number,
  period: FortnightPeriod,
): Promise<FortnightNavInfo | null> => {
  const fortnight = await prisma.fortnight.findFirst({
    where: {
      ...ownerFilter,
      year,
      month,
      period,
    },
    select: {
      id: true,
      label: true,
      period: true,
    },
  });

  if (!fortnight) return null;

  return {
    label: fortnight.label,
    id: fortnight.id,
    period: fortnight.period,
  };
};
