import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/require-admin';
import { adminSetTempPasswordSchema } from '@/schemas/admin.schema';
import { setTemporaryPasswordForUser } from '@/lib/server/admin/password-override';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  try {
    const { id: idParam } = await context.params;
    const targetUserId = Number(idParam);
    if (!Number.isFinite(targetUserId)) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = adminSetTempPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: first?.message ?? 'Datos inválidos',
          field: first?.path?.[0],
        },
        { status: 400 },
      );
    }

    const result = await setTemporaryPasswordForUser({
      admin: gate.admin,
      targetUserId,
      temporaryPassword: parsed.data.temporaryPassword,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        'Contraseña temporal actualizada. Comunícasela al usuario por un canal seguro.',
    });
  } catch (error) {
    console.error('Admin password override error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la contraseña' },
      { status: 500 },
    );
  }
}
