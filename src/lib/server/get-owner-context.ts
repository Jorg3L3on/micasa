import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export type OwnerFilter = { user_id: number } | { house_id: number };

export type OwnerContextRole = 'owner' | 'admin' | 'member';

export type OwnerContextSuccess = {
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  role: OwnerContextRole;
};

export type OwnerContextResult =
  | OwnerContextSuccess
  | { error: NextResponse };

export async function getOwnerContext(
  request: Request,
): Promise<OwnerContextResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
    };
  }
  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) {
    return {
      error: NextResponse.json({ error: 'Usuario inválido' }, { status: 400 }),
    };
  }

  const { searchParams } = new URL(request.url);
  let ownerType = searchParams.get('ownerType') ?? 'user';
  let ownerId = Number(searchParams.get('ownerId'));

  if (!searchParams.has('ownerType') && !searchParams.has('ownerId')) {
    ownerType = 'user';
    ownerId = userId;
  }

  if (ownerType === 'house') {
    if (Number.isNaN(ownerId)) {
      return {
        error: NextResponse.json(
          { error: 'ownerId inválido' },
          { status: 400 },
        ),
      };
    }
    const membership = await prisma.houseMember.findFirst({
      where: {
        house_id: ownerId,
        user_id: userId,
      },
    });
    if (!membership) {
      return {
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }
    const role: OwnerContextRole =
      membership.role.toLowerCase() as OwnerContextRole;
    return {
      ownerType: 'house',
      ownerId,
      ownerFilter: { house_id: ownerId },
      role,
    };
  }

  if (Number.isNaN(ownerId)) ownerId = userId;
  const role: OwnerContextRole = 'owner';
  return {
    ownerType: 'user',
    ownerId,
    ownerFilter: { user_id: ownerId },
    role,
  };
}
