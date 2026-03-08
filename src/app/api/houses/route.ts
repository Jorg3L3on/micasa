import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createHouse, listUserHouses } from '@/lib/house/house.service';
import { z } from 'zod';

const createHouseSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255, 'Nombre demasiado largo'),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const houses = await listUserHouses(userId);
    return NextResponse.json(houses);
  } catch (e) {
    console.error('GET /api/houses error:', e);
    return NextResponse.json(
      { error: 'Error al listar las casas. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const userId = Number(session.user.id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Usuario inválido' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = createHouseSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const message = first?.message ?? 'Datos inválidos';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name } = parsed.data;
    const house = await createHouse(userId, name);
    return NextResponse.json(house);
  } catch (e) {
    console.error('POST /api/houses error:', e);
    return NextResponse.json(
      { error: 'Error al crear la casa. Inténtalo de nuevo.' },
      { status: 500 }
    );
  }
}
