export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecurrenceUnit = 'DAY' | 'WEEK' | 'MONTH';

export type TaskRecurrenceDto = {
  unit: RecurrenceUnit;
  every: number;
  anchor: string | null;
};

import type { AssigneeSummaryDto } from '@/types/tasks-assignee';

export type TaskItemDto = {
  id: number;
  list_id: number;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  recurrence: TaskRecurrenceDto | null;
  sort_order: number;
  assignee_user_id: number | null;
  assignee: AssigneeSummaryDto | null;
  created_at: string;
  updated_at: string;
};
