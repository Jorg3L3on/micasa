import prisma from '@/lib/prisma';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { lenderNameKey, normalizeLenderName } from '@/lib/finance/lender-name';

function ownerData(ownerType: 'user' | 'house', ownerId: number) {
  return ownerType === 'user'
    ? { user_id: ownerId, house_id: null }
    : { user_id: null, house_id: ownerId };
}

export async function findOrCreateLenderForOwner(
  ownerType: 'user' | 'house',
  ownerId: number,
  ownerFilter: OwnerFilter,
  name: string,
): Promise<{ id: number; name: string }> {
  const normalized = normalizeLenderName(name);
  if (!normalized) {
    throw new Error('El prestamista es obligatorio');
  }
  const key = lenderNameKey(normalized);
  const existing = await prisma.lender.findMany({
    where: ownerFilter,
    select: { id: true, name: true },
  });
  const match = existing.find((row) => lenderNameKey(row.name) === key);
  if (match) return match;

  return prisma.lender.create({
    data: {
      ...ownerData(ownerType, ownerId),
      name: normalized,
    },
    select: { id: true, name: true },
  });
}

export async function resolveLenderForLoanInput(
  ownerType: 'user' | 'house',
  ownerId: number,
  ownerFilter: OwnerFilter,
  input: { lender?: string | null; lenderId?: number | null },
): Promise<{ id: number; name: string }> {
  if (input.lenderId) {
    const lender = await prisma.lender.findFirst({
      where: { id: input.lenderId, ...ownerFilter },
      select: { id: true, name: true },
    });
    if (!lender) {
      throw new Error('El prestamista no pertenece a este contexto');
    }
    return lender;
  }

  return findOrCreateLenderForOwner(
    ownerType,
    ownerId,
    ownerFilter,
    input.lender ?? '',
  );
}
