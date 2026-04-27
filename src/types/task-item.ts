export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type RecurrenceUnit = 'DAY' | 'WEEK' | 'MONTH';

export type TaskRecurrenceDto = {
  unit: RecurrenceUnit;
  every: number;
  anchor: string | null;
};

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
  created_at: string;
  updated_at: string;
};
