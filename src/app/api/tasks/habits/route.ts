import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createHabit, listHabits } from '@/lib/server/tasks/habit.service';
import { createHabitSchema } from '@/schemas/habit.schema';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    return NextResponse.json(await listHabits(context), { status: 200 });
  } catch (error) {
    console.error('tasks habits GET', error);
    return NextResponse.json({ error: 'No se pudieron cargar los hábitos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const input = createHabitSchema.parse(await request.json());
    return NextResponse.json(await createHabit(context, input), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('tasks habits POST', error);
    return NextResponse.json({ error: 'No se pudo crear el hábito' }, { status: 500 });
  }
}
