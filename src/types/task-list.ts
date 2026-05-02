import type { AssigneeSummaryDto } from '@/types/tasks-assignee';

export type TaskListDto = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  tasks_count: number;
  completed_count: number;
  assignee_user_id: number | null;
  assignee: AssigneeSummaryDto | null;
  created_at: string;
  updated_at: string;
};
