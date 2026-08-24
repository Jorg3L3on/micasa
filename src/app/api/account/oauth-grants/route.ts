import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const GRANT_SELECT = {
  id: true,
  client_id: true,
  scopes: true,
  last_used_at: true,
  expires_at: true,
  revoked_at: true,
  created_at: true,
  client: { select: { client_name: true } },
} as const;

const toGrantDto = (grant: {
  id: number;
  client_id: string;
  scopes: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  client: { client_name: string };
}) => ({
  id: grant.id,
  client_id: grant.client_id,
  client_name: grant.client.client_name,
  scopes: grant.scopes,
  last_used_at: grant.last_used_at?.toISOString() ?? null,
  expires_at: grant.expires_at?.toISOString() ?? null,
  revoked_at: grant.revoked_at?.toISOString() ?? null,
  created_at: grant.created_at.toISOString(),
});

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

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    if (userId instanceof NextResponse) return userId;

    const grants = await prisma.mcpOAuthGrant.findMany({
      where: { user_id: userId },
      select: GRANT_SELECT,
      orderBy: [{ revoked_at: 'asc' }, { created_at: 'desc' }],
    });

    return NextResponse.json(grants.map(toGrantDto));
  } catch (error) {
    console.error('Error listing oauth grants:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las conexiones OAuth' },
      { status: 500 },
    );
  }
}
