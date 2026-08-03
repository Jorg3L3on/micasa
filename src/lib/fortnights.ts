import { formatCalendarDate } from '@/lib/calendar-dates';
import prisma from '@/lib/prisma';
import { FortnightPeriod, Prisma } from '@/generated/prisma/client';
import { getCanonicalFortnightBounds } from '@/lib/finance/budget-period-windows';

type ResolveFortnightOwner =
  | { ownerType: 'user'; ownerId: number }
  | { ownerType: 'house'; ownerId: number };

type ResolveFortnightParams = ResolveFortnightOwner & {
  year: number;
  month: number;
  period: FortnightPeriod;
  label?: string;
  tx?: Prisma.TransactionClient;
};

export const resolveOrCreateFortnight = async (
  params: ResolveFortnightParams,
) => {
  const { ownerType, ownerId, year, month, period, label, tx } = params;
  const client = tx ?? prisma;

  const whereBase = {
    year,
    month,
    period,
  } as const;

  const where =
    ownerType === 'user'
      ? { ...whereBase, user_id: ownerId, house_id: null }
      : { ...whereBase, house_id: ownerId, user_id: null };

  const existing = await client.fortnight.findFirst({
    where,
  });

  const bounds = getCanonicalFortnightBounds(year, month, period);
  const defaultLabel =
    period === 'FIRST'
      ? `Primera quincena - ${month}/${year}`
      : `Segunda quincena - ${month}/${year}`;

  if (existing) {
    const startYmd = formatCalendarDate(existing.start_date);
    const endYmd = formatCalendarDate(existing.end_date);
    const expectedStart = formatCalendarDate(bounds.start_date);
    const expectedEnd = formatCalendarDate(bounds.end_date);
    if (startYmd !== expectedStart || endYmd !== expectedEnd) {
      return client.fortnight.update({
        where: { id: existing.id },
        data: {
          start_date: bounds.start_date,
          end_date: bounds.end_date,
        },
      });
    }
    return existing;
  }

  return client.fortnight.create({
    data: {
      label: label ?? defaultLabel,
      start_date: bounds.start_date,
      end_date: bounds.end_date,
      month,
      year,
      period,
      closed: false,
      user_id: ownerType === 'user' ? ownerId : null,
      house_id: ownerType === 'house' ? ownerId : null,
    },
  });
};

