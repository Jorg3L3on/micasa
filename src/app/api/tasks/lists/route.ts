import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOwnerContext } from '@/lib/server/get-owner-context';
import { createTaskList, listTaskLists } from '@/lib/server/tasks/task-list.service';
import { parseAssigneeUserIdFilter } from '@/lib/server/tasks/parse-assignee-query';
import { AssigneeInvalidError } from '@/lib/server/tasks/validate-assignee';
import { createTaskListSchema } from '@/schemas/task-list.schema';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const assigneeUserId = parseAssigneeUserIdFilter(request.nextUrl.searchParams);
    const rows = await listTaskLists(context, assigneeUserId);
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('tasks lists GET', error);
    return NextResponse.json({ error: 'No se pudieron cargar las listas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const context = await getOwnerContext(request);
    if ('error' in context) return context.error;
    const body = await request.json();
    const input = createTaskListSchema.parse(body);
    const row = await createTaskList(context, input);
    return NextResponse.json(row, { status: 201 });
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
    console.error('tasks lists POST', error);
    return NextResponse.json({ error: 'No se pudo crear la lista' }, { status: 500 });
  }
}
