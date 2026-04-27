import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createRoutine, listRoutines } from '@/lib/server/tasks/routine.service';
import { createRoutineSchema } from '@/schemas/routine.schema';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    return NextResponse.json(await listRoutines(context), { status: 200 });
  } catch (error) {
    console.error('tasks routines GET', error);
    return NextResponse.json({ error: 'No se pudieron cargar las rutinas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const input = createRoutineSchema.parse(await request.json());
    return NextResponse.json(await createRoutine(context, input), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('tasks routines POST', error);
    return NextResponse.json({ error: 'No se pudo crear la rutina' }, { status: 500 });
  }
}
