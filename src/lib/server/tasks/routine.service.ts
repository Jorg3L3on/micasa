import prisma from '@/lib/prisma';
import { serializeRoutine } from '@/lib/server/tasks/serialize-tasks';
import { tasksOwnerWhere } from '@/lib/server/tasks/tasks-owner';
import {
  resolveAssigneeForCreate,
  resolveAssigneeForUpdate,
} from '@/lib/server/tasks/validate-assignee';
import type {
  CompleteRoutineInput,
  CreateRoutineInput,
  UpdateRoutineInput,
} from '@/schemas/routine.schema';
import type { RoutineDto } from '@/types/routine';

type TaskOwnerParams = {
  ownerType: 'user' | 'house';
  ownerId: number;
};

export class RoutineNotFoundError extends Error {
  constructor(message = 'Rutina no encontrada') {
    super(message);
    this.name = 'RoutineNotFoundError';
  }
}

const ROUTINE_INCLUDE = {
  steps: { orderBy: { sort_order: 'asc' as const } },
  runs: { orderBy: { run_on: 'desc' as const }, take: 1 },
  assignee: { select: { id: true, name: true } },
} as const;

export async function listRoutines(
  owner: TaskOwnerParams,
  assigneeUserIdFilter?: number,
): Promise<RoutineDto[]> {
  const rows = await prisma.routine.findMany({
    where: {
      ...tasksOwnerWhere(owner.ownerType, owner.ownerId),
      ...(assigneeUserIdFilter != null ? { assignee_user_id: assigneeUserIdFilter } : {}),
    },
    include: ROUTINE_INCLUDE,
    orderBy: [{ active: 'desc' }, { updated_at: 'desc' }],
  });
  return rows.map(serializeRoutine);
}

export async function createRoutine(
  owner: TaskOwnerParams,
  input: CreateRoutineInput,
): Promise<RoutineDto> {
  const ownerFilter = tasksOwnerWhere(owner.ownerType, owner.ownerId);
  const assignee_user_id = await resolveAssigneeForCreate(owner, input.assignee_user_id);
  const row = await prisma.routine.create({
    data: {
      name: input.name.trim(),
      description: input.description ?? null,
      time_of_day: input.time_of_day ?? 'CUSTOM',
      active_days: input.active_days ?? [],
      user_id: ownerFilter.user_id,
      house_id: ownerFilter.house_id,
      assignee_user_id,
      steps: {
        create: input.steps.map((step, index) => ({
          title: step.title.trim(),
          description: step.description ?? null,
          is_optional: step.is_optional ?? false,
          sort_order: index,
        })),
      },
    },
    include: ROUTINE_INCLUDE,
  });
  return serializeRoutine(row);
}

export async function updateRoutine(
  owner: TaskOwnerParams,
  id: number,
  input: UpdateRoutineInput,
): Promise<RoutineDto> {
  const exists = await prisma.routine.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!exists) throw new RoutineNotFoundError();

  const assigneePatch = await resolveAssigneeForUpdate(owner, input.assignee_user_id);

  await prisma.$transaction(async (tx) => {
    await tx.routine.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.time_of_day !== undefined ? { time_of_day: input.time_of_day } : {}),
        ...(input.active_days !== undefined ? { active_days: input.active_days } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(assigneePatch.kind === 'value'
          ? { assignee_user_id: assigneePatch.assignee_user_id }
          : {}),
      },
    });

    if (input.steps !== undefined) {
      await tx.routineStep.deleteMany({ where: { routine_id: id } });
      await tx.routineStep.createMany({
        data: input.steps.map((step, index) => ({
          routine_id: id,
          title: step.title.trim(),
          description: step.description ?? null,
          is_optional: step.is_optional ?? false,
          sort_order: index,
        })),
      });
    }
  });

  const row = await prisma.routine.findFirstOrThrow({
    where: { id },
    include: ROUTINE_INCLUDE,
  });
  return serializeRoutine(row);
}

export async function completeRoutine(
  owner: TaskOwnerParams,
  routineId: number,
  userId: number,
  input: CompleteRoutineInput,
): Promise<RoutineDto> {
  const routine = await prisma.routine.findFirst({
    where: { id: routineId, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    include: { steps: true },
  });
  if (!routine) throw new RoutineNotFoundError();

  const runOn = input.run_on ? new Date(input.run_on) : new Date();
  const totalSteps = routine.steps.length;
  const completedSteps = Math.min(input.completed_steps ?? totalSteps, totalSteps);

  await prisma.routineRun.upsert({
    where: { routine_id_run_on: { routine_id: routineId, run_on: runOn } },
    create: {
      routine_id: routineId,
      run_on: runOn,
      completed_steps: completedSteps,
      total_steps: totalSteps,
      completed: completedSteps >= totalSteps,
      completed_by_user_id: userId,
    },
    update: {
      completed_steps: completedSteps,
      total_steps: totalSteps,
      completed: completedSteps >= totalSteps,
      completed_by_user_id: userId,
    },
  });

  const row = await prisma.routine.findFirstOrThrow({
    where: { id: routineId },
    include: ROUTINE_INCLUDE,
  });
  return serializeRoutine(row);
}

export async function deleteRoutine(owner: TaskOwnerParams, id: number): Promise<void> {
  const exists = await prisma.routine.findFirst({
    where: { id, ...tasksOwnerWhere(owner.ownerType, owner.ownerId) },
    select: { id: true },
  });
  if (!exists) throw new RoutineNotFoundError();
  await prisma.routine.delete({ where: { id } });
}
