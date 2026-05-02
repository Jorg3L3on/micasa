import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import {
  RoutineNotFoundError,
  deleteRoutine,
  updateRoutine,
} from '@/lib/server/tasks/routine.service';
import { AssigneeInvalidError } from '@/lib/server/tasks/validate-assignee';
import { updateRoutineSchema } from '@/schemas/routine.schema';

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
    const input = updateRoutineSchema.parse(await request.json());
    return NextResponse.json(await updateRoutine(context, id, input), { status: 200 });
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof AssigneeInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('tasks routine PATCH', error);
    return NextResponse.json({ error: 'No se pudo actualizar la rutina' }, { status: 500 });
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
    await deleteRoutine(context, id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RoutineNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('tasks routine DELETE', error);
    return NextResponse.json({ error: 'No se pudo eliminar la rutina' }, { status: 500 });
  }
}
