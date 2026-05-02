import prisma from '@/lib/prisma';

export type TaskOwnerContext = {
  ownerType: 'user' | 'house';
  ownerId: number;
};

export class AssigneeInvalidError extends Error {
  constructor(message = 'Asignación inválida') {
    super(message);
    this.name = 'AssigneeInvalidError';
  }
}

const assertHouseMember = async (houseId: number, userId: number): Promise<void> => {
  const membership = await prisma.houseMember.findFirst({
    where: { house_id: houseId, user_id: userId },
    select: { id: true },
  });
  if (!membership) {
    throw new AssigneeInvalidError('El usuario seleccionado no es miembro de esta casa');
  }
};

/**
 * Resolves assignee for create. House requires a valid member id.
 * User-owned scope always stores null.
 */
export async function resolveAssigneeForCreate(
  owner: TaskOwnerContext,
  assigneeUserId: number | null | undefined,
): Promise<number | null> {
  if (owner.ownerType === 'user') {
    if (assigneeUserId != null) {
      throw new AssigneeInvalidError(
        'No puedes asignar un miembro en tu espacio personal',
      );
    }
    return null;
  }
  if (assigneeUserId == null || assigneeUserId <= 0 || !Number.isInteger(assigneeUserId)) {
    throw new AssigneeInvalidError('Selecciona un miembro de la casa');
  }
  await assertHouseMember(owner.ownerId, assigneeUserId);
  return assigneeUserId;
}

export type AssigneeUpdateResolved =
  | { kind: 'skip' }
  | { kind: 'value'; assignee_user_id: number | null };

/**
 * Partial update: omit assignee field → skip; set explicit value → validate.
 * House cannot clear assignee to null (legacy rows may still be null until edited).
 */
export async function resolveAssigneeForUpdate(
  owner: TaskOwnerContext,
  assigneeUserId: number | null | undefined,
): Promise<AssigneeUpdateResolved> {
  if (assigneeUserId === undefined) {
    return { kind: 'skip' };
  }
  if (owner.ownerType === 'user') {
    if (assigneeUserId != null) {
      throw new AssigneeInvalidError(
        'No puedes asignar un miembro en tu espacio personal',
      );
    }
    return { kind: 'value', assignee_user_id: null };
  }
  if (assigneeUserId === null) {
    throw new AssigneeInvalidError('Selecciona un miembro de la casa');
  }
  if (assigneeUserId <= 0 || !Number.isInteger(assigneeUserId)) {
    throw new AssigneeInvalidError('Selecciona un miembro de la casa');
  }
  await assertHouseMember(owner.ownerId, assigneeUserId);
  return { kind: 'value', assignee_user_id: assigneeUserId };
}
