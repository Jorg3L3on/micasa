import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createTaskItem, listTaskItems } from '@/lib/server/tasks/task-item.service';
import { parseAssigneeUserIdFilter } from '@/lib/server/tasks/parse-assignee-query';
import { AssigneeInvalidError } from '@/lib/server/tasks/validate-assignee';
import { createTaskItemSchema } from '@/schemas/task-item.schema';

const parseListId = (raw: string | null): number | undefined => {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const requireUserId = async (): Promise<number | null> => {
  const session = await auth();
  const userId = Number(session?.user?.id);
  return Number.isFinite(userId) ? userId : null;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const listId = parseListId(request.nextUrl.searchParams.get('listId'));
    const assigneeUserId = parseAssigneeUserIdFilter(request.nextUrl.searchParams);
    return NextResponse.json(await listTaskItems(context, listId, assigneeUserId), {
      status: 200,
    });
  } catch (error) {
    console.error('tasks items GET', error);
    return NextResponse.json({ error: 'No se pudieron cargar las tareas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const userId = await requireUserId();
    if (userId == null) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const input = createTaskItemSchema.parse(await request.json());
    return NextResponse.json(await createTaskItem(context, userId, input), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof AssigneeInvalidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('tasks items POST', error);
    return NextResponse.json({ error: 'No se pudo crear la tarea' }, { status: 500 });
  }
}
