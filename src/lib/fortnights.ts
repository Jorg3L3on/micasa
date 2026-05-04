import prisma from '@/lib/prisma';
import { FortnightPeriod, Prisma } from '@/generated/prisma/client';

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

  if (existing) {
    return existing;
  }

  const startDay = period === 'FIRST' ? 1 : 16;
  const endDay =
    period === 'FIRST'
      ? 15
      : new Date(year, month, 0).getDate(); // last day of month

  const defaultLabel =
    period === 'FIRST'
      ? `Primera quincena - ${month}/${year}`
      : `Segunda quincena - ${month}/${year}`;

  return client.fortnight.create({
    data: {
      label: label ?? defaultLabel,
      start_date: new Date(year, month - 1, startDay),
      end_date: new Date(year, month - 1, endDay),
      month,
      year,
      period,
      closed: false,
      user_id: ownerType === 'user' ? ownerId : null,
      house_id: ownerType === 'house' ? ownerId : null,
    },
  });
};

