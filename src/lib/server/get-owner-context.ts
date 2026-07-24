import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export type OwnerFilter =
  | { user_id: number; house_id: null }
  | { user_id: null; house_id: number };

export type OwnerContextRole = 'owner' | 'admin' | 'member';

export type OwnerContextSuccess = {
  /** Authenticated session user id (always the caller). */
  userId: number;
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  role: OwnerContextRole;
};

export type OwnerContextResult =
  | OwnerContextSuccess
  | { error: NextResponse };

function normalizeSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Misma resolución de propietario que las rutas `/api/*` sin hacer HTTP interno.
 * La sesión sigue saliendo de `auth()` (petición actual del RSC); el Request solo
 * aporta `ownerType` / `ownerId` en la query.
 */
export function createRequestWithOwnerSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Request {
  const u = new URL('http://localhost.local/internal-owner-context');
  const ot = normalizeSearchParam(searchParams.ownerType);
  const oi = normalizeSearchParam(searchParams.ownerId);
  if (ot) u.searchParams.set('ownerType', ot);
  if (oi) u.searchParams.set('ownerId', oi);
  return new Request(u);
}

export async function getOwnerContextFromPageSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<OwnerContextResult> {
  return getOwnerContext(createRequestWithOwnerSearchParams(searchParams));
}

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
      userId,
      ownerType: 'house',
      ownerId,
      ownerFilter: { user_id: null, house_id: ownerId },
      role,
    };
  }

  if (Number.isNaN(ownerId)) ownerId = userId;
  if (ownerId !== userId) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  const role: OwnerContextRole = 'owner';
  return {
    userId,
    ownerType: 'user',
    ownerId,
    ownerFilter: { user_id: ownerId, house_id: null },
    role,
  };
}
