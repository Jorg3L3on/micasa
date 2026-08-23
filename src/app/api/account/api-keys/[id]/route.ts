import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { renameApiKeySchema } from '@/schemas/api-key.schema';

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
    const input = renameApiKeySchema.parse(body);

    const updated = await prisma.apiKey.update({
      where: { id: resolved.keyId },
      data: { name: input.name },
      select: { id: true, name: true },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
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
