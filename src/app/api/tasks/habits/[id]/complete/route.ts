import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { HabitNotFoundError, completeHabit } from '@/lib/server/tasks/habit.service';
import { completeHabitSchema } from '@/schemas/habit.schema';

type RouteParams = { params: Promise<{ id: string }> };

const parseId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function POST(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const input = completeHabitSchema.parse(await request.json().catch(() => ({})));
    return NextResponse.json(await completeHabit(context, id, userId, input), { status: 200 });
  } catch (error) {
    if (error instanceof HabitNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('tasks habit complete POST', error);
    return NextResponse.json({ error: 'No se pudo registrar el hábito' }, { status: 500 });
  }
}
