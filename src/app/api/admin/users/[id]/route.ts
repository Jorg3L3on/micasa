import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/require-admin';
import {
  buildAdminRecentActivity,
  getAdminUserDetail,
} from '@/lib/server/admin/users';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  try {
    const { id: idParam } = await context.params;
    const userId = Number(idParam);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const user = await getAdminUserDetail(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 },
      );
    }

    const recent_activity = await buildAdminRecentActivity(userId, 50);
    return NextResponse.json({ user, recent_activity });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json(
      { error: 'Error al cargar el usuario' },
      { status: 500 },
    );
  }
}
