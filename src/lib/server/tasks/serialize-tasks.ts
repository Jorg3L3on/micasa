import type { HabitDto, HabitLogDto } from '@/types/habit';
import type { RoutineDto, RoutineRunDto, RoutineStepDto } from '@/types/routine';
import type { TaskItemDto } from '@/types/task-item';
import type { TaskListDto } from '@/types/task-list';

type TaskListRow = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
  items: Array<{ id: number; status: string }>;
};

export const serializeTaskList = (row: TaskListRow): TaskListDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  color: row.color,
  archived: row.archived,
  tasks_count: row.items.length,
  completed_count: row.items.filter((item) => item.status === 'DONE').length,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

type TaskItemRow = {
  id: number;
  list_id: number;
  title: string;
  notes: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  due_at: Date | null;
  completed_at: Date | null;
  recurrence_unit: 'DAY' | 'WEEK' | 'MONTH' | null;
  recurrence_every: number | null;
  recurrence_anchor: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export const serializeTaskItem = (row: TaskItemRow): TaskItemDto => ({
  id: row.id,
  list_id: row.list_id,
  title: row.title,
  notes: row.notes,
  status: row.status,
  priority: row.priority,
  due_at: row.due_at?.toISOString() ?? null,
  completed_at: row.completed_at?.toISOString() ?? null,
  recurrence:
    row.recurrence_unit && row.recurrence_every
      ? {
          unit: row.recurrence_unit,
          every: row.recurrence_every,
          anchor: row.recurrence_anchor?.toISOString() ?? null,
        }
      : null,
  sort_order: row.sort_order,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

type HabitLogRow = {
  id: number;
  completed_on: Date;
  note: string | null;
  created_at: Date;
};

export const serializeHabitLog = (row: HabitLogRow): HabitLogDto => ({
  id: row.id,
  completed_on: row.completed_on.toISOString(),
  note: row.note,
  created_at: row.created_at.toISOString(),
});

type HabitRow = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  recurrence_unit: 'DAY' | 'WEEK' | 'MONTH';
  recurrence_every: number;
  target_per_period: number;
  reminder_time: string | null;
  created_at: Date;
  updated_at: Date;
  logs: HabitLogRow[];
};

export const serializeHabit = (row: HabitRow): HabitDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  active: row.active,
  recurrence_unit: row.recurrence_unit,
  recurrence_every: row.recurrence_every,
  target_per_period: row.target_per_period,
  reminder_time: row.reminder_time,
  current_streak: computeCurrentStreak(row.logs.map((entry) => entry.completed_on)),
  logs: row.logs.map(serializeHabitLog),
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

type RoutineStepRow = {
  id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_optional: boolean;
};

export const serializeRoutineStep = (row: RoutineStepRow): RoutineStepDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  sort_order: row.sort_order,
  is_optional: row.is_optional,
});

type RoutineRunRow = {
  id: number;
  run_on: Date;
  completed_steps: number;
  total_steps: number;
  completed: boolean;
  created_at: Date;
  updated_at: Date;
};

export const serializeRoutineRun = (row: RoutineRunRow): RoutineRunDto => ({
  id: row.id,
  run_on: row.run_on.toISOString(),
  completed_steps: row.completed_steps,
  total_steps: row.total_steps,
  completed: row.completed,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

type RoutineRow = {
  id: number;
  name: string;
  description: string | null;
  time_of_day: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'CUSTOM';
  active_days: number[];
  active: boolean;
  created_at: Date;
  updated_at: Date;
  steps: RoutineStepRow[];
  runs: RoutineRunRow[];
};

export const serializeRoutine = (row: RoutineRow): RoutineDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  time_of_day: row.time_of_day,
  active_days: row.active_days,
  active: row.active,
  steps: row.steps.map(serializeRoutineStep),
  latest_run: row.runs[0] ? serializeRoutineRun(row.runs[0]) : null,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});

const dayMs = 24 * 60 * 60 * 1000;

const toDayStamp = (value: Date): number =>
  Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());

const computeCurrentStreak = (values: Date[]): number => {
  if (values.length === 0) return 0;
  const uniqueDays = Array.from(new Set(values.map(toDayStamp))).sort((a, b) => b - a);
  let streak = 0;
  let expected = uniqueDays[0];
  for (const day of uniqueDays) {
    if (day !== expected) break;
    streak += 1;
    expected -= dayMs;
  }
  return streak;
};
