import prisma from '@/lib/prisma';
import { serializeTaskList } from '@/lib/server/tasks/serialize-tasks';
import { tasksOwnerWhere } from '@/lib/server/tasks/tasks-owner';
import type {
  CreateTaskListInput,
  UpdateTaskListInput,
} from '@/schemas/task-list.schema';
import type { TaskListDto } from '@/types/task-list';

export type TaskOwnerParams = {
  ownerType: 'user' | 'house';
  ownerId: number;
};

export class TaskListNotFoundError extends Error {
  constructor(message = 'Lista no encontrada') {
    super(message);
    this.name = 'TaskListNotFoundError';
  }
}

export async function listTaskLists(owner: TaskOwnerParams): Promise<TaskListDto[]> {
  const rows = await prisma.taskList.findMany({
    where: tasksOwnerWhere(owner.ownerType, owner.ownerId),
    include: { items: { select: { id: true, status: true } } },
    orderBy: [{ archived: 'asc' }, { updated_at: 'desc' }],
  });
  return rows.map(serializeTaskList);
}

export async function createTaskList(
  owner: TaskOwnerParams,
  input: CreateTaskListInput,
): Promise<TaskListDto> {
  const ownerFilter = tasksOwnerWhere(owner.ownerType, owner.ownerId);
  const row = await prisma.taskList.create({
    data: {
      name: input.name.trim(),
      description: input.description ?? null,
      color: input.color ?? null,
      user_id: ownerFilter.user_id,
      house_id: ownerFilter.house_id,
    },
    include: { items: { select: { id: true, status: true } } },
  });
  return serializeTaskList(row);
}

export async function getTaskListById(
  owner: TaskOwnerParams,
  id: number,
): Promise<TaskListDto> {
  const row = await prisma.taskList.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    include: { items: { select: { id: true, status: true } } },
  });
  if (!row) throw new TaskListNotFoundError();
  return serializeTaskList(row);
}

export async function updateTaskList(
  owner: TaskOwnerParams,
  id: number,
  input: UpdateTaskListInput,
): Promise<TaskListDto> {
  const exists = await prisma.taskList.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!exists) throw new TaskListNotFoundError();

  const row = await prisma.taskList.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.color !== undefined ? { color: input.color ?? null } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
    },
    include: { items: { select: { id: true, status: true } } },
  });
  return serializeTaskList(row);
}

export async function deleteTaskList(owner: TaskOwnerParams, id: number): Promise<void> {
  const exists = await prisma.taskList.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!exists) throw new TaskListNotFoundError();
  await prisma.taskList.delete({ where: { id } });
}
