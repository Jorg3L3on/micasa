import {
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';

export type GoalStatus = 'archived' | 'achieved' | 'overdue' | 'active';

export type GoalMetricsInput = {
  amount: number;
  goal_amount: number | null | undefined;
  goal_due_date: string | Date | null | undefined;
  created_at: string | Date | null | undefined;
  active?: boolean;
  /** Override "today" for tests (YYYY-MM-DD). */
  today?: string;
};

export type GoalMetrics = {
  status: GoalStatus;
  remaining: number;
  daysLeft: number;
  /** 0–1 fraction of timeline elapsed from created_at → due date. */
  progressToday: number;
  /** 0–1 fraction saved toward goal_amount (1 when archived or achieved). */
  savedProgress: number;
  monthlyTip: number;
  isComplete: boolean;
  goalAmount: number;
};

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  archived: 'Archivada',
  achieved: 'Completada',
  overdue: 'Vencida',
  active: 'Activa',
};

function toCalendarYmd(value: string | Date | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatCalendarDate(parsed);
  }
  if (Number.isNaN(value.getTime())) return null;
  return formatCalendarDate(value);
}

/** Signed calendar-day difference: end − start (Mexico City civil days via UTC noon). */
function calendarDaysBetween(startYmd: string, endYmd: string): number {
  const start = parseCalendarDate(startYmd).getTime();
  const end = parseCalendarDate(endYmd).getTime();
  return Math.round((end - start) / 86_400_000);
}

function isDueOnOrBeforeToday(
  goalDueDate: string | null,
  today: string,
): boolean {
  if (goalDueDate == null) return true;
  return calendarDaysBetween(today, goalDueDate) <= 0;
}

export function resolveGoalStatus(input: {
  amount: number;
  goal_amount: number;
  goal_due_date: string | null;
  active?: boolean;
  today: string;
}): GoalStatus {
  if (input.active === false) return 'archived';

  const funded =
    input.goal_amount > 0 && input.amount >= input.goal_amount;

  // Fully funded only counts as Completada once the due date has arrived
  // (or there is no due date). Early funding stays Activa until then.
  if (funded && isDueOnOrBeforeToday(input.goal_due_date, input.today)) {
    return 'achieved';
  }

  if (
    input.goal_due_date != null &&
    calendarDaysBetween(input.today, input.goal_due_date) < 0
  ) {
    return 'overdue';
  }

  return 'active';
}

export function computeGoalMetrics(input: GoalMetricsInput): GoalMetrics {
  const goalAmount = Math.max(0, Number(input.goal_amount ?? 0));
  const balance = Number(input.amount ?? 0);
  const remaining = Math.max(0, goalAmount - balance);
  const today = input.today ?? todayCalendarDate();
  const dueYmd = toCalendarYmd(input.goal_due_date);
  const startYmd = toCalendarYmd(input.created_at) ?? today;

  const status = resolveGoalStatus({
    amount: balance,
    goal_amount: goalAmount,
    goal_due_date: dueYmd,
    active: input.active,
    today,
  });

  let daysLeft = 0;
  if (dueYmd) {
    daysLeft = Math.max(0, calendarDaysBetween(today, dueYmd));
  }

  let progressToday = 0;
  if (status === 'archived' || status === 'achieved') {
    progressToday = 1;
  } else if (dueYmd) {
    const totalDays = Math.max(1, calendarDaysBetween(startYmd, dueYmd));
    const elapsed = calendarDaysBetween(startYmd, today);
    progressToday = Math.min(1, Math.max(0, elapsed / totalDays));
  }

  // Always reflect real savings ratio — archived/achieved must not fake 100%.
  const savedProgress =
    goalAmount > 0 ? Math.min(1, Math.max(0, balance / goalAmount)) : 0;

  const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
  const monthlyTip =
    status === 'archived' || status === 'achieved' || remaining <= 0
      ? 0
      : remaining / monthsLeft;

  const isComplete = status === 'archived' || status === 'achieved';

  return {
    status,
    remaining,
    daysLeft: status === 'archived' ? 0 : daysLeft,
    progressToday,
    savedProgress,
    monthlyTip,
    isComplete,
    goalAmount,
  };
}

/** True when the saved balance has not yet reached the goal amount. */
export function isGoalIncomplete(input: {
  amount: number;
  goal_amount?: number | null;
}): boolean {
  const goalAmount = Math.max(0, Number(input.goal_amount ?? 0));
  if (goalAmount <= 0) return true;
  return Number(input.amount ?? 0) < goalAmount;
}

/**
 * Activas tab order: incomplete first, then earliest due date.
 * Goals without a due date sort last within their completeness group.
 */
export function compareActiveGoals(
  a: {
    amount: number;
    goal_amount?: number | null;
    goal_due_date?: string | Date | null;
    name?: string | null;
  },
  b: {
    amount: number;
    goal_amount?: number | null;
    goal_due_date?: string | Date | null;
    name?: string | null;
  },
): number {
  const aIncomplete = isGoalIncomplete(a);
  const bIncomplete = isGoalIncomplete(b);
  if (aIncomplete !== bIncomplete) return aIncomplete ? -1 : 1;

  const aDue = toCalendarYmd(a.goal_due_date);
  const bDue = toCalendarYmd(b.goal_due_date);
  if (aDue == null && bDue == null) {
    return (a.name ?? '').localeCompare(b.name ?? '', 'es');
  }
  if (aDue == null) return 1;
  if (bDue == null) return -1;
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;
  return (a.name ?? '').localeCompare(b.name ?? '', 'es');
}

/** Ensures due dates used in metrics are valid calendar dates when parsing forms. */
export function parseGoalDueDate(ymd: string): Date {
  return parseCalendarDate(ymd);
}
