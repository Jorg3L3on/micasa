'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type {
  CreateTaskListInput,
  UpdateTaskListInput,
} from '@/schemas/task-list.schema';
import type {
  CreateTaskItemInput,
  UpdateTaskItemInput,
} from '@/schemas/task-item.schema';
import type {
  CompleteHabitInput,
  CreateHabitInput,
  UpdateHabitInput,
} from '@/schemas/habit.schema';
import type {
  CompleteRoutineInput,
  CreateRoutineInput,
  UpdateRoutineInput,
} from '@/schemas/routine.schema';
import type { TaskListDto } from '@/types/task-list';
import type { TaskItemDto } from '@/types/task-item';
import type { HabitDto } from '@/types/habit';
import type { RoutineDto } from '@/types/routine';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

export async function listTaskLists(
  context?: FinanceContextType,
  opts?: { assigneeUserId?: number },
): Promise<TaskListDto[]> {
  const qs =
    opts?.assigneeUserId != null ? `?assigneeUserId=${opts.assigneeUserId}` : '';
  return clientFetchFromApi<TaskListDto[]>(`/api/tasks/lists${qs}`, undefined, context);
}

export async function getTaskList(
  id: number,
  context?: FinanceContextType,
): Promise<TaskListDto> {
  return clientFetchFromApi<TaskListDto>(`/api/tasks/lists/${id}`, undefined, context);
}

export async function createTaskList(
  body: CreateTaskListInput,
  context?: FinanceContextType,
): Promise<TaskListDto> {
  return clientFetchFromApi<TaskListDto>(
    '/api/tasks/lists',
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function updateTaskList(
  id: number,
  body: UpdateTaskListInput,
  context?: FinanceContextType,
): Promise<TaskListDto> {
  return clientFetchFromApi<TaskListDto>(
    `/api/tasks/lists/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    context,
  );
}

export async function deleteTaskList(id: number, context?: FinanceContextType): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/tasks/lists/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listTaskItems(
  context?: FinanceContextType,
  listId?: number,
  opts?: { assigneeUserId?: number },
): Promise<TaskItemDto[]> {
  const params = new URLSearchParams();
  if (listId != null) params.set('listId', String(listId));
  if (opts?.assigneeUserId != null) params.set('assigneeUserId', String(opts.assigneeUserId));
  const q = params.toString();
  return clientFetchFromApi<TaskItemDto[]>(
    `/api/tasks/items${q ? `?${q}` : ''}`,
    undefined,
    context,
  );
}

export async function createTaskItem(
  body: CreateTaskItemInput,
  context?: FinanceContextType,
): Promise<TaskItemDto> {
  return clientFetchFromApi<TaskItemDto>(
    '/api/tasks/items',
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function updateTaskItem(
  id: number,
  body: UpdateTaskItemInput,
  context?: FinanceContextType,
): Promise<TaskItemDto> {
  return clientFetchFromApi<TaskItemDto>(
    `/api/tasks/items/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    context,
  );
}

export async function completeTaskItem(
  id: number,
  context?: FinanceContextType,
): Promise<TaskItemDto> {
  return updateTaskItem(id, { status: 'DONE' }, context);
}

export async function deleteTaskItem(id: number, context?: FinanceContextType): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/tasks/items/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listHabits(
  context?: FinanceContextType,
  opts?: { assigneeUserId?: number },
): Promise<HabitDto[]> {
  const qs =
    opts?.assigneeUserId != null ? `?assigneeUserId=${opts.assigneeUserId}` : '';
  return clientFetchFromApi<HabitDto[]>(`/api/tasks/habits${qs}`, undefined, context);
}

export async function createHabit(
  body: CreateHabitInput,
  context?: FinanceContextType,
): Promise<HabitDto> {
  return clientFetchFromApi<HabitDto>(
    '/api/tasks/habits',
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function updateHabit(
  id: number,
  body: UpdateHabitInput,
  context?: FinanceContextType,
): Promise<HabitDto> {
  return clientFetchFromApi<HabitDto>(
    `/api/tasks/habits/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    context,
  );
}

export async function completeHabit(
  id: number,
  body: CompleteHabitInput = {},
  context?: FinanceContextType,
): Promise<HabitDto> {
  return clientFetchFromApi<HabitDto>(
    `/api/tasks/habits/${id}/complete`,
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function deleteHabit(id: number, context?: FinanceContextType): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/tasks/habits/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listRoutines(
  context?: FinanceContextType,
  opts?: { assigneeUserId?: number },
): Promise<RoutineDto[]> {
  const qs =
    opts?.assigneeUserId != null ? `?assigneeUserId=${opts.assigneeUserId}` : '';
  return clientFetchFromApi<RoutineDto[]>(`/api/tasks/routines${qs}`, undefined, context);
}

export async function createRoutine(
  body: CreateRoutineInput,
  context?: FinanceContextType,
): Promise<RoutineDto> {
  return clientFetchFromApi<RoutineDto>(
    '/api/tasks/routines',
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function updateRoutine(
  id: number,
  body: UpdateRoutineInput,
  context?: FinanceContextType,
): Promise<RoutineDto> {
  return clientFetchFromApi<RoutineDto>(
    `/api/tasks/routines/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    context,
  );
}

export async function completeRoutine(
  id: number,
  body: CompleteRoutineInput = {},
  context?: FinanceContextType,
): Promise<RoutineDto> {
  return clientFetchFromApi<RoutineDto>(
    `/api/tasks/routines/${id}/complete`,
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function deleteRoutine(id: number, context?: FinanceContextType): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/tasks/routines/${id}`,
    { method: 'DELETE' },
    context,
  );
}
