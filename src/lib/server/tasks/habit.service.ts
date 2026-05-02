import prisma from '@/lib/prisma';
import { serializeHabit } from '@/lib/server/tasks/serialize-tasks';
import { tasksOwnerWhere } from '@/lib/server/tasks/tasks-owner';
import {
  resolveAssigneeForCreate,
  resolveAssigneeForUpdate,
} from '@/lib/server/tasks/validate-assignee';
import type {
  CompleteHabitInput,
  CreateHabitInput,
  UpdateHabitInput,
} from '@/schemas/habit.schema';
import type { HabitDto } from '@/types/habit';

type TaskOwnerParams = {
  ownerType: 'user' | 'house';
  ownerId: number;
};

export class HabitNotFoundError extends Error {
  constructor(message = 'Hábito no encontrado') {
    super(message);
    this.name = 'HabitNotFoundError';
  }
}

const HABIT_INCLUDE = {
  logs: { orderBy: { completed_on: 'desc' as const }, take: 20 },
  assignee: { select: { id: true, name: true } },
} as const;

export async function listHabits(
  owner: TaskOwnerParams,
  assigneeUserIdFilter?: number,
): Promise<HabitDto[]> {
  const rows = await prisma.habit.findMany({
    where: {
      ...tasksOwnerWhere(owner.ownerType, owner.ownerId),
      ...(assigneeUserIdFilter != null ? { assignee_user_id: assigneeUserIdFilter } : {}),
    },
    include: HABIT_INCLUDE,
    orderBy: [{ active: 'desc' }, { updated_at: 'desc' }],
  });
  return rows.map(serializeHabit);
}

export async function createHabit(
  owner: TaskOwnerParams,
  input: CreateHabitInput,
): Promise<HabitDto> {
  const ownerFilter = tasksOwnerWhere(owner.ownerType, owner.ownerId);
  const assignee_user_id = await resolveAssigneeForCreate(owner, input.assignee_user_id);
  const row = await prisma.habit.create({
    data: {
      name: input.name.trim(),
      description: input.description ?? null,
      recurrence_unit: input.recurrence_unit,
      recurrence_every: input.recurrence_every ?? 1,
      target_per_period: input.target_per_period ?? 1,
      reminder_time: input.reminder_time ?? null,
      user_id: ownerFilter.user_id,
      house_id: ownerFilter.house_id,
      assignee_user_id,
    },
    include: HABIT_INCLUDE,
  });
  return serializeHabit(row);
}

export async function updateHabit(
  owner: TaskOwnerParams,
  id: number,
  input: UpdateHabitInput,
): Promise<HabitDto> {
  const exists = await prisma.habit.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!exists) throw new HabitNotFoundError();

  const assigneePatch = await resolveAssigneeForUpdate(owner, input.assignee_user_id);

  const row = await prisma.habit.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.recurrence_unit !== undefined ? { recurrence_unit: input.recurrence_unit } : {}),
      ...(input.recurrence_every !== undefined ? { recurrence_every: input.recurrence_every } : {}),
      ...(input.target_per_period !== undefined
        ? { target_per_period: input.target_per_period }
        : {}),
      ...(input.reminder_time !== undefined ? { reminder_time: input.reminder_time ?? null } : {}),
      ...(assigneePatch.kind === 'value'
        ? { assignee_user_id: assigneePatch.assignee_user_id }
        : {}),
    },
    include: HABIT_INCLUDE,
  });
  return serializeHabit(row);
}

export async function completeHabit(
  owner: TaskOwnerParams,
  habitId: number,
  userId: number,
  input: CompleteHabitInput,
): Promise<HabitDto> {
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!habit) throw new HabitNotFoundError();

  const completedOn = input.completed_on ? new Date(input.completed_on) : new Date();
  await prisma.habitLog.upsert({
    where: { habit_id_completed_on: { habit_id: habitId, completed_on: completedOn } },
    create: {
      habit_id: habitId,
      completed_on: completedOn,
      note: input.note ?? null,
      completed_by_user_id: userId,
    },
    update: {
      note: input.note ?? null,
      completed_by_user_id: userId,
    },
  });

  const row = await prisma.habit.findFirstOrThrow({
    where: { id: habitId },
    include: HABIT_INCLUDE,
  });
  return serializeHabit(row);
}

export async function deleteHabit(owner: TaskOwnerParams, id: number): Promise<void> {
  const exists = await prisma.habit.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!exists) throw new HabitNotFoundError();
  await prisma.habit.delete({ where: { id } });
}
