import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { HabitNotFoundError, deleteHabit, updateHabit } from '@/lib/server/tasks/habit.service';
import { updateHabitSchema } from '@/schemas/habit.schema';

type RouteParams = { params: Promise<{ id: string }> };

const parseId = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    const input = updateHabitSchema.parse(await request.json());
    return NextResponse.json(await updateHabit(context, id, input), { status: 200 });
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
    console.error('tasks habit PATCH', error);
    return NextResponse.json({ error: 'No se pudo actualizar el hábito' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    await deleteHabit(context, id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof HabitNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('tasks habit DELETE', error);
    return NextResponse.json({ error: 'No se pudo eliminar el hábito' }, { status: 500 });
  }
}
