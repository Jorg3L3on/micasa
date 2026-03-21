/**
 * Next calendar occurrence of a card's payment day (due_day of month).
 * Used for hub sorting and "due soon" badges when full statement data is not loaded.
 */
export const getNextCalendarDueDate = (
  dueDay: number,
  from = new Date(),
): Date => {
  const fromLocal = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  );
  const year = fromLocal.getFullYear();
  const month = fromLocal.getMonth();
  const lastDayThisMonth = new Date(year, month + 1, 0).getDate();
  const clamped = Math.min(dueDay, lastDayThisMonth);
  let candidate = new Date(year, month, clamped);
  if (candidate < fromLocal) {
    const nextMonth = month + 1;
    const ny = nextMonth > 11 ? year + 1 : year;
    const nm = nextMonth > 11 ? 0 : nextMonth;
    const lastDayNext = new Date(ny, nm + 1, 0).getDate();
    const clampedNext = Math.min(dueDay, lastDayNext);
    candidate = new Date(ny, nm, clampedNext);
  }
  return candidate;
};

export const startOfLocalDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const daysBetweenLocal = (a: Date, b: Date): number => {
  const ms = 24 * 60 * 60 * 1000;
  const sa = startOfLocalDay(a).getTime();
  const sb = startOfLocalDay(b).getTime();
  return Math.round((sb - sa) / ms);
};
