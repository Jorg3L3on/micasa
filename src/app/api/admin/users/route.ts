import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/server/with-admin';
import { searchAdminUsers } from '@/lib/server/admin/users';

export async function GET(request: NextRequest) {
  return withAdmin(request, async () => {
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
  });
}
