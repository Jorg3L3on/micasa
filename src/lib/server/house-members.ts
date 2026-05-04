import prisma from '@/lib/prisma';

export class AssigneeInvalidError extends Error {
  constructor(message = 'Asignación inválida') {
    super(message);
    this.name = 'AssigneeInvalidError';
  }
}

export const assertHouseMember = async (
  houseId: number,
  userId: number,
): Promise<void> => {
  const membership = await prisma.houseMember.findFirst({
    where: { house_id: houseId, user_id: userId },
    select: { id: true },
  });
  if (!membership) {
    throw new AssigneeInvalidError('El usuario seleccionado no es miembro de esta casa');
  }
};
