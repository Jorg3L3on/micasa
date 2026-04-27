import type { RecurrenceUnit } from '@/types/task-item';

export type HabitLogDto = {
  id: number;
  completed_on: string;
  note: string | null;
  created_at: string;
};

export type HabitDto = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  recurrence_unit: RecurrenceUnit;
  recurrence_every: number;
  target_per_period: number;
  reminder_time: string | null;
  current_streak: number;
  logs: HabitLogDto[];
  created_at: string;
  updated_at: string;
};
