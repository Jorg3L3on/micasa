export type TaskListDto = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  tasks_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
};
