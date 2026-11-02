import prisma from '@/lib/prisma';
import { createUserToHouseTransfer } from '@/lib/transfers';
import { DomainError } from '@/lib/finance/domain-error';
import type { OwnerContextSuccess } from '@/lib/server/get-owner-context';

export type UserToHouseTransferRequest = {
  /** Personal side; must be the caller. */
  userId: number;
  houseId: number;
  amount: number;
  userWalletId?: number | null;
  houseWalletId?: number | null;
  userFortnightId: number;
  houseFortnightId: number;
  note?: string | null;
};

type TransferCaller = Pick<OwnerContextSuccess, 'userId' | 'ownerType' | 'ownerId'>;

/**
 * USER_TO_HOUSE contribution with every ownership rule: only the caller may
 * fund from their personal account, the active context must be one of the two
 * sides, the caller must belong to the house, and fortnights and wallets must
 * belong to their side. Shared by POST /api/transfers and transfer_to_house.
 */
export async function transferUserToHouse(
  caller: TransferCaller,
  input: UserToHouseTransferRequest,
) {
  if (input.userId !== caller.userId) {
    throw new DomainError(
      'TRANSFER_FORBIDDEN',
      'Solo puedes transferir desde tu cuenta personal',
      403,
    );
  }
  if (caller.ownerType === 'user' && input.userId !== caller.ownerId) {
    throw new DomainError(
      'TRANSFER_FORBIDDEN',
      'Solo puedes transferir desde tu cuenta personal',
      403,
    );
  }
  if (caller.ownerType === 'house' && input.houseId !== caller.ownerId) {
    throw new DomainError(
      'HOUSE_CONTEXT_MISMATCH',
      'La casa de la transferencia no coincide con el contexto activo',
    );
  }

  const membership = await prisma.houseMember.findFirst({
    where: { house_id: input.houseId, user_id: input.userId },
    select: { id: true },
  });
  if (!membership) {
    throw new DomainError('NOT_HOUSE_MEMBER', 'No eres miembro de esta casa', 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, active: true },
  });
  if (!user?.active) {
    throw new DomainError('USER_NOT_FOUND', 'Usuario no encontrado o inactivo');
  }

  const house = await prisma.house.findUnique({
    where: { id: input.houseId },
    select: { id: true },
  });
  if (!house) {
    throw new DomainError('HOUSE_NOT_FOUND', 'Casa no encontrada');
  }

  const userFortnight = await prisma.fortnight.findUnique({
    where: { id: input.userFortnightId },
    select: { user_id: true, house_id: true },
  });
  if (
    !userFortnight ||
    userFortnight.user_id !== input.userId ||
    userFortnight.house_id !== null
  ) {
    throw new DomainError(
      'INVALID_USER_FORTNIGHT',
      'Quincena personal inválida para esta transferencia',
    );
  }

  const houseFortnight = await prisma.fortnight.findUnique({
    where: { id: input.houseFortnightId },
    select: { user_id: true, house_id: true },
  });
  if (
    !houseFortnight ||
    houseFortnight.house_id !== input.houseId ||
    houseFortnight.user_id !== null
  ) {
    throw new DomainError(
      'INVALID_HOUSE_FORTNIGHT',
      'Quincena de la casa inválida para esta transferencia',
    );
  }

  if (input.userWalletId != null) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: input.userWalletId },
      select: { user_id: true, house_id: true },
    });
    if (!wallet || wallet.user_id !== input.userId || wallet.house_id !== null) {
      throw new DomainError(
        'INVALID_USER_WALLET',
        'Billetera personal inválida para esta transferencia',
      );
    }
  }

  if (input.houseWalletId != null) {
    const wallet = await prisma.wallet.findUnique({
      where: { id: input.houseWalletId },
      select: { user_id: true, house_id: true },
    });
    if (!wallet || wallet.house_id !== input.houseId || wallet.user_id !== null) {
      throw new DomainError(
        'INVALID_HOUSE_WALLET',
        'Billetera de la casa inválida para esta transferencia',
      );
    }
  }

  return createUserToHouseTransfer({
    userId: input.userId,
    houseId: input.houseId,
    amount: input.amount,
    userWalletId: input.userWalletId ?? null,
    houseWalletId: input.houseWalletId ?? null,
    userFortnightId: input.userFortnightId,
    houseFortnightId: input.houseFortnightId,
    note: input.note ?? null,
  });
}
