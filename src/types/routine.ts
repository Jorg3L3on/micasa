export type RoutineTimeOfDay = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'CUSTOM';

export type RoutineStepDto = {
  id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_optional: boolean;
};

export type RoutineRunDto = {
  id: number;
  run_on: string;
  completed_steps: number;
  total_steps: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type RoutineDto = {
  id: number;
  name: string;
  description: string | null;
  time_of_day: RoutineTimeOfDay;
  active_days: number[];
  active: boolean;
  steps: RoutineStepDto[];
  latest_run: RoutineRunDto | null;
  created_at: string;
  updated_at: string;
};
