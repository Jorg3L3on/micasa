import { coerceToCalendarDate } from '@/lib/calendar-dates';
import prisma from '@/lib/prisma';
import { serializeTaskItem } from '@/lib/server/tasks/serialize-tasks';
import { tasksOwnerWhere } from '@/lib/server/tasks/tasks-owner';
import {
  resolveAssigneeForCreate,
  resolveAssigneeForUpdate,
} from '@/lib/server/tasks/validate-assignee';
import type {
  CreateTaskItemInput,
  UpdateTaskItemInput,
} from '@/schemas/task-item.schema';
import type { TaskItemDto } from '@/types/task-item';

type TaskOwnerParams = {
  ownerType: 'user' | 'house';
  ownerId: number;
};

export class TaskItemNotFoundError extends Error {
  constructor(message = 'Tarea no encontrada') {
    super(message);
    this.name = 'TaskItemNotFoundError';
  }
}

const resolveCompletion = (status?: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED') =>
  status === 'DONE' ? new Date() : status ? null : undefined;

const TASK_ITEM_INCLUDE = {
  assignee: { select: { id: true, name: true } },
} as const;

export async function listTaskItems(
  owner: TaskOwnerParams,
  listId?: number,
  assigneeUserIdFilter?: number,
): Promise<TaskItemDto[]> {
  const rows = await prisma.taskItem.findMany({
    where: {
      ...(listId ? { list_id: listId } : {}),
      ...(assigneeUserIdFilter != null ? { assignee_user_id: assigneeUserIdFilter } : {}),
      list: { ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    },
    include: TASK_ITEM_INCLUDE,
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  });
  return rows.map(serializeTaskItem);
}

export async function createTaskItem(
  owner: TaskOwnerParams,
  userId: number,
  input: CreateTaskItemInput,
): Promise<TaskItemDto> {
  const list = await prisma.taskList.findFirst({
    where: { id: input.list_id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true, assignee_user_id: true },
  });
  if (!list) throw new TaskItemNotFoundError('Lista no encontrada');

  const mergedAssignee = input.assignee_user_id ?? list.assignee_user_id;
  const assignee_user_id = await resolveAssigneeForCreate(owner, mergedAssignee ?? undefined);

  const maxSort = await prisma.taskItem.aggregate({
    where: { list_id: input.list_id },
    _max: { sort_order: true },
  });

  const row = await prisma.taskItem.create({
    data: {
      list_id: input.list_id,
      title: input.title.trim(),
      notes: input.notes ?? null,
      priority: input.priority ?? 'MEDIUM',
      due_at: input.due_at ? coerceToCalendarDate(input.due_at) : null,
      recurrence_unit: input.recurrence?.unit ?? null,
      recurrence_every: input.recurrence?.every ?? null,
      recurrence_anchor: input.recurrence?.anchor
        ? coerceToCalendarDate(input.recurrence.anchor)
        : null,
      sort_order: (maxSort._max.sort_order ?? -1) + 1,
      created_by_user_id: userId,
      assignee_user_id,
    },
    include: TASK_ITEM_INCLUDE,
  });
  return serializeTaskItem(row);
}

export async function updateTaskItem(
  owner: TaskOwnerParams,
  id: number,
  input: UpdateTaskItemInput,
): Promise<TaskItemDto> {
  const exists = await prisma.taskItem.findFirst({
    where: { id, list: { ...tasksOwnerWhere(owner.ownerType, owner.ownerId) } },
    select: { id: true },
  });
  if (!exists) throw new TaskItemNotFoundError();

  const assigneePatch = await resolveAssigneeForUpdate(owner, input.assignee_user_id);

  const row = await prisma.taskItem.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
      ...(input.status !== undefined
        ? { status: input.status, completed_at: resolveCompletion(input.status) }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.due_at !== undefined
        ? { due_at: input.due_at ? coerceToCalendarDate(input.due_at) : null }
        : {}),
      ...(input.recurrence !== undefined
        ? {
            recurrence_unit: input.recurrence?.unit ?? null,
            recurrence_every: input.recurrence?.every ?? null,
            recurrence_anchor: input.recurrence?.anchor
              ? coerceToCalendarDate(input.recurrence.anchor)
              : null,
          }
        : {}),
      ...(input.sort_order !== undefined ? { sort_order: input.sort_order } : {}),
      ...(assigneePatch.kind === 'value'
        ? { assignee_user_id: assigneePatch.assignee_user_id }
        : {}),
    },
    include: TASK_ITEM_INCLUDE,
  });
  return serializeTaskItem(row);
}

export async function deleteTaskItem(owner: TaskOwnerParams, id: number): Promise<void> {
  const exists = await prisma.taskItem.findFirst({
    where: { id, list: { ...tasksOwnerWhere(owner.ownerType, owner.ownerId) } },
    select: { id: true },
  });
  if (!exists) throw new TaskItemNotFoundError();
  await prisma.taskItem.delete({ where: { id } });
}
