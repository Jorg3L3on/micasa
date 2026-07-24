import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/server/require-admin';
import { searchAdminUsers } from '@/lib/server/admin/users';

export async function GET(request: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  try {
    const q = request.nextUrl.searchParams.get('q') ?? undefined;
    const takeRaw = request.nextUrl.searchParams.get('take');
    const take = takeRaw ? Number(takeRaw) : undefined;
    const users = await searchAdminUsers({
      q,
      take: Number.isFinite(take) ? take : undefined,
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin users list error:', error);
    return NextResponse.json(
      { error: 'Error al listar usuarios' },
      { status: 500 },
    );
  }
}
