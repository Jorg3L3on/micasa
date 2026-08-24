import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

async function requireSessionUserId(): Promise<number | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = Number(session.user.id);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
  }
  return userId;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireSessionUserId();
    if (userId instanceof NextResponse) return userId;

    const { id } = await context.params;
    const grantId = Number(id);
    if (!Number.isInteger(grantId) || grantId <= 0) {
      return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
    }

    const grant = await prisma.mcpOAuthGrant.findFirst({
      where: { id: grantId, user_id: userId },
      select: { id: true, revoked_at: true },
    });
    if (!grant) {
      return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
    }
    if (grant.revoked_at != null) {
      return NextResponse.json({ revoked: true });
    }

    await prisma.mcpOAuthGrant.update({
      where: { id: grantId },
      data: { revoked_at: new Date() },
    });

    return NextResponse.json({ revoked: true });
  } catch (error) {
    console.error('Error revoking oauth grant:', error);
    return NextResponse.json(
      { error: 'No se pudo revocar la conexión OAuth' },
      { status: 500 },
    );
  }
}
