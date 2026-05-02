import type { RecurrenceUnit } from '@/types/task-item';
import type { AssigneeSummaryDto } from '@/types/tasks-assignee';

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
  assignee_user_id: number | null;
  assignee: AssigneeSummaryDto | null;
  current_streak: number;
  logs: HabitLogDto[];
  created_at: string;
  updated_at: string;
};
