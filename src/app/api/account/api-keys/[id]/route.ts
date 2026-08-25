import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { renameApiKeySchema, updateApiKeyContextsSchema } from '@/schemas/api-key.schema';
import {
  replaceApiKeyAllowedContexts,
  validateSelectableContexts,
} from '@/lib/server/agent-allowed-contexts';
import { AgentAuthError } from '@/lib/server/agent-auth-error';

async function resolveOwnKeyId(
  params: Promise<{ id: string }>,
): Promise<
  | { userId: number; keyId: number }
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
  const keyId = Number(id);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    return {
      error: NextResponse.json({ error: 'Id inválido' }, { status: 400 }),
    };
  }

  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, user_id: userId },
    select: { id: true },
  });
  if (!key) {
    return {
      error: NextResponse.json(
        { error: 'Conexión no encontrada' },
        { status: 404 },
      ),
    };
  }

  return { userId, keyId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await resolveOwnKeyId(params);
    if ('error' in resolved) return resolved.error;

    const body = await request.json();
    const renameInput = renameApiKeySchema.safeParse(body);
    const contextsInput = updateApiKeyContextsSchema.safeParse(body);

    if (!renameInput.success && !contextsInput.success) {
      return NextResponse.json(
        {
          error: 'Error de validación',
          details: renameInput.error?.issues ?? contextsInput.error?.issues,
        },
        { status: 400 },
      );
    }

    if (renameInput.success) {
      await prisma.apiKey.update({
        where: { id: resolved.keyId },
        data: { name: renameInput.data.name },
      });
    }

    if (contextsInput.success) {
      const validated = await validateSelectableContexts(
        resolved.userId,
        contextsInput.data.allowed_contexts,
        { allowEmpty: true },
      );
      await replaceApiKeyAllowedContexts(resolved.keyId, validated);
    }

    const updated = await prisma.apiKey.findUniqueOrThrow({
      where: { id: resolved.keyId },
      select: {
        id: true,
        name: true,
        allowedContexts: { select: { owner_type: true, owner_id: true } },
      },
    });

    return NextResponse.json(
      {
        id: updated.id,
        name: updated.name,
        allowed_contexts: updated.allowedContexts.map((row) => ({
          ownerType: row.owner_type === 'USER' ? 'user' : 'house',
          ownerId: row.owner_id,
        })),
      },
      { status: 200 },
    );
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
    console.error('Error renaming api key:', error);
    return NextResponse.json(
      { error: 'No se pudo renombrar la conexión' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolved = await resolveOwnKeyId(params);
    if ('error' in resolved) return resolved.error;

    // Revocation, not deletion: the row stays for audit; the Bearer stops
    // working immediately (resolveAgentUser rejects revoked keys).
    await prisma.apiKey.update({
      where: { id: resolved.keyId },
      data: { revoked_at: new Date() },
    });

    return NextResponse.json({ revoked: true }, { status: 200 });
  } catch (error) {
    console.error('Error revoking api key:', error);
    return NextResponse.json(
      { error: 'No se pudo revocar la conexión' },
      { status: 500 },
    );
  }
}
