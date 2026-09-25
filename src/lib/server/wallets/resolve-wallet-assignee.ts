import {
  AssigneeInvalidError,
  assertHouseMember,
} from '@/lib/server/house-members';

/**
 * Optional assignee for house wallets (null = shared). User-owned wallets never store an assignee.
 */
export const resolveWalletAssignee = async (
  ownerType: 'user' | 'house',
  ownerId: number,
  assigneeUserId: number | null | undefined,
  existingAssigneeUserId?: number | null,
): Promise<number | null> => {
  if (assigneeUserId == null) {
    return null;
  }
  if (ownerType === 'user') {
    throw new AssigneeInvalidError(
      'No puedes asignar un miembro en tu espacio personal',
    );
  }
  if (assigneeUserId <= 0 || !Number.isInteger(assigneeUserId)) {
    throw new AssigneeInvalidError('Selecciona un miembro de la casa');
  }
  if (existingAssigneeUserId != null && assigneeUserId === existingAssigneeUserId) {
    return assigneeUserId;
  }
  await assertHouseMember(ownerId, assigneeUserId);
  return assigneeUserId;
};
