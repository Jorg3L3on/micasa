import type { HabitDto } from '@/types/habit';

export const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const startOfLocalWeekMonday = (d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const dow = x.getDay();
  const offsetFromMonday = (dow + 6) % 7;
  x.setDate(x.getDate() - offsetFromMonday);
  return x;
};

export const habitCompletedOnLocalDay = (habit: HabitDto, day: Date): boolean =>
  habit.logs.some((log) => isSameLocalDay(new Date(log.completed_on), day));

export const habitDoneToday = (habit: HabitDto, now = new Date()): boolean =>
  habitCompletedOnLocalDay(habit, now);

/** Last 7 local calendar days ending at `now`, oldest → newest (length 7). */
export const habitWeekCompletionFlags = (habit: HabitDto, now = new Date()): boolean[] => {
  const flags: boolean[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    flags.push(habitCompletedOnLocalDay(habit, day));
  }
  return flags;
};

export const countCompletionsInCurrentPeriod = (
  habit: HabitDto,
  now = new Date(),
): number => {
  const u = habit.recurrence_unit;
  return habit.logs.filter((log) => {
    const d = new Date(log.completed_on);
    if (u === 'DAY') return isSameLocalDay(d, now);
    if (u === 'WEEK') {
      const ws = startOfLocalWeekMonday(now);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      return d >= ws && d < we;
    }
    if (u === 'MONTH') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return false;
  }).length;
};
