import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { agentContextListUpdateSchema } from '@/schemas/agent-context.schema';
import {
  replaceOAuthGrantAllowedContexts,
  validateSelectableContexts,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/agent-auth-error';

const updateOAuthGrantContextsSchema = z.object({
  allowed_contexts: agentContextListUpdateSchema,
});

type RouteContext = { params: Promise<{ id: string }> };

async function resolveOwnGrantId(
  params: Promise<{ id: string }>,
): Promise<
  | { userId: number; grantId: number }
  | { error: NextResponse }
> {
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

  const { id } = await params;
  const grantId = Number(id);
  if (!Number.isInteger(grantId) || grantId <= 0) {
    return {
      error: NextResponse.json({ error: 'Id inválido' }, { status: 400 }),
    };
  }

  const grant = await prisma.mcpOAuthGrant.findFirst({
    where: { id: grantId, user_id: userId },
    select: { id: true },
  });
  if (!grant) {
    return {
      error: NextResponse.json(
        { error: 'Conexión no encontrada' },
        { status: 404 },
      ),
    };
  }

  return { userId, grantId };
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const resolved = await resolveOwnGrantId(params);
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const input = updateOAuthGrantContextsSchema.parse(body);
    const validated = await validateSelectableContexts(
      resolved.userId,
      input.allowed_contexts,
      { allowEmpty: true },
    );
    await replaceOAuthGrantAllowedContexts(resolved.grantId, validated);

    const updated = await prisma.mcpOAuthGrant.findUniqueOrThrow({
      where: { id: resolved.grantId },
      select: {
        id: true,
        allowedContexts: { select: { owner_type: true, owner_id: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      allowed_contexts: updated.allowedContexts.map((row) => ({
        ownerType: row.owner_type === 'USER' ? 'user' : 'house',
        ownerId: row.owner_id,
      })),
    });
  } catch (error) {
    if (error instanceof AgentAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error updating oauth grant contexts:', error);
    return NextResponse.json(
      { error: 'No se pudieron actualizar los contextos' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveOwnGrantId(context.params);
    if ('error' in resolved) return resolved.error;

    const grant = await prisma.mcpOAuthGrant.findFirst({
      where: { id: resolved.grantId, user_id: resolved.userId },
      select: { id: true, revoked_at: true },
    });
    if (!grant) {
      return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
    }
    if (grant.revoked_at != null) {
      return NextResponse.json({ revoked: true });
    }

    await prisma.mcpOAuthGrant.update({
      where: { id: resolved.grantId },
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
