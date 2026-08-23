import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createApiKeySchema } from '@/schemas/api-key.schema';
import { generateAgentToken, hashAgentToken } from '@/lib/server/agent-token';
import { enforceRateLimit } from '@/lib/server/rate-limit';

const API_KEY_LIST_SELECT = {
  id: true,
  name: true,
  key_prefix: true,
  scopes: true,
  last_used_at: true,
  revoked_at: true,
  created_at: true,
} as const;

const toApiKeyDto = (key: {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}) => ({
  id: key.id,
  name: key.name,
  key_prefix: key.key_prefix,
  scopes: key.scopes,
  last_used_at: key.last_used_at?.toISOString() ?? null,
  revoked_at: key.revoked_at?.toISOString() ?? null,
  created_at: key.created_at.toISOString(),
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

    const keys = await prisma.apiKey.findMany({
      where: { user_id: userId },
      select: API_KEY_LIST_SELECT,
      orderBy: [{ revoked_at: 'asc' }, { created_at: 'desc' }],
    });

    return NextResponse.json(keys.map(toApiKeyDto), { status: 200 });
  } catch (error) {
    console.error('Error listing api keys:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las conexiones' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    if (userId instanceof NextResponse) return userId;

    const limited = await enforceRateLimit(
      request,
      'mutation:api-key-create',
      userId,
    );
    if (limited) return limited;

    const body = await request.json();
    const input = createApiKeySchema.parse(body);

    const { token, keyPrefix } = generateAgentToken();
    const keyHash = await hashAgentToken(token);

    const created = await prisma.apiKey.create({
      data: {
        user_id: userId,
        name: input.name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: input.scopes,
      },
      select: API_KEY_LIST_SELECT,
    });

    // The plaintext token travels ONLY in this response; never persisted.
    return NextResponse.json(
      { ...toApiKeyDto(created), token },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error creating api key:', error);
    return NextResponse.json(
      { error: 'No se pudo crear la conexión' },
      { status: 500 },
    );
  }
}
