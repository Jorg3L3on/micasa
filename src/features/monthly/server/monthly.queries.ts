import type { FortnightPeriod } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type FortnightNavInfo = {
  label: string;
  id: number;
  period: FortnightPeriod;
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
