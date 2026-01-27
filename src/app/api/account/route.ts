import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateAccountSchema } from '@/schemas/account.schema';

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first?.path?.[0];
      const message = first?.message ?? 'Datos inválidos';
      return NextResponse.json(
        { error: message, field: path },
        { status: 400 }
      );
    }

    const { name, newPassword, confirmPassword } = parsed.data;
    const userId = Number(session.user.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const updateData: { name?: string; password?: string } = {};

    if (name != null && name.trim().length > 0) {
      updateData.name = name.trim();
    }

    const wantsNewPassword =
      newPassword != null && String(newPassword).trim().length > 0;
    if (wantsNewPassword) {
      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: 'Las contraseñas no coinciden', field: 'confirmPassword' },
          { status: 400 }
        );
      }
      updateData.password = await hash(String(newPassword).trim(), 10);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No hay cambios para aplicar' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      name: updateData.name != null ? user.name : undefined,
    });
  } catch (e) {
    console.error('Account update error:', e);
    return NextResponse.json(
      { error: 'Error al actualizar la cuenta. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
