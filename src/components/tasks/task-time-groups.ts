import type { TaskItemDto } from '@/types/task-item';

export type TaskTemporalBucket = 'atrasada' | 'hoy' | 'manana' | 'proxima' | 'sin_fecha';

const startOfDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const getStartOfDay = (value: Date): Date => startOfDay(value);

export const getEndOfDay = (value: Date): Date => {
  const end = startOfDay(value);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const isSameDay = (a: Date, b: Date): boolean =>
  startOfDay(a).getTime() === startOfDay(b).getTime();

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

export const getTaskTemporalBucket = (
  task: TaskItemDto,
  now = new Date(),
): TaskTemporalBucket => {
  if (!task.due_at) return 'sin_fecha';

  const dueDate = startOfDay(new Date(task.due_at));
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  if (dueDate < today) return 'atrasada';
  if (dueDate.getTime() === today.getTime()) return 'hoy';
  if (dueDate.getTime() === tomorrow.getTime()) return 'manana';
  return 'proxima';
};

export const getTaskUrgencyLabel = (
  bucket: TaskTemporalBucket,
  dueAt: string | null,
): string => {
  if (bucket === 'sin_fecha') return 'Sin fecha';
  if (!dueAt) return 'Sin fecha';

  const dueDate = new Date(dueAt).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });

  switch (bucket) {
    case 'atrasada':
      return `Atrasada (${dueDate})`;
    case 'hoy':
      return 'Vence hoy';
    case 'manana':
      return 'Vence mañana';
    case 'proxima':
      return `Próxima (${dueDate})`;
    default:
      return 'Sin fecha';
  }
};

const temporalRank: Record<TaskTemporalBucket, number> = {
  atrasada: 0,
  hoy: 1,
  manana: 2,
  proxima: 3,
  sin_fecha: 4,
};

export const compareTasksByUrgency = (a: TaskItemDto, b: TaskItemDto): number => {
  const bucketA = getTaskTemporalBucket(a);
  const bucketB = getTaskTemporalBucket(b);

  if (temporalRank[bucketA] !== temporalRank[bucketB]) {
    return temporalRank[bucketA] - temporalRank[bucketB];
  }

  if (!a.due_at && !b.due_at) return a.sort_order - b.sort_order;
  if (!a.due_at) return 1;
  if (!b.due_at) return -1;
  return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
};

export const filterTasksBySelectedDay = (
  tasks: TaskItemDto[],
  selectedDate: Date,
): TaskItemDto[] =>
  tasks.filter((task) => {
    if (!task.due_at) return false;
    return isSameDay(new Date(task.due_at), selectedDate);
  });

