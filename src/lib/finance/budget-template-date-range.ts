import {
  addCalendarDays,
  isValidCalendarDateString,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
import type { BudgetFrequency } from '@/schemas/budget.schema';

type DateRange = { start_date: Date; end_date: Date };

type BudgetTemplateDateRangeInput = {
  frequency: BudgetFrequency;
  now?: Date;
  currentFortnight?: DateRange | null;
  customStartDate?: string | null;
  customEndDate?: string | null;
};

function parseOptionalCalendarDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (isValidCalendarDateString(trimmed)) {
    return parseCalendarDate(trimmed);
  }
  // Legacy ISO / datetime form values — keep prior behavior.
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computeBudgetTemplateDateRange({
  frequency,
  now = new Date(),
  currentFortnight,
  customStartDate,
  customEndDate,
}: BudgetTemplateDateRangeInput): { start_date: Date | null; end_date: Date | null } {
  if (frequency === 'CUSTOM') {
    return {
      start_date: parseOptionalCalendarDate(customStartDate),
      end_date: parseOptionalCalendarDate(customEndDate),
    };
  }

  if (frequency === 'BIWEEKLY') {
    if (!currentFortnight) {
      throw new Error('currentFortnight required for BIWEEKLY budgets');
    }
    return {
      start_date: currentFortnight.start_date,
      end_date: currentFortnight.end_date,
    };
  }

  const today = todayCalendarDate(now);

  if (frequency === 'DAILY') {
    const day = parseCalendarDate(today);
    return {
      start_date: day,
      end_date: day,
    };
  }

  const [year, month, day] = today.split('-').map(Number);
  const weekStart = addCalendarDays(
    today,
    -new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay(),
  );
  const weekEnd = addCalendarDays(weekStart, 6);

  return {
    start_date: parseCalendarDate(weekStart),
    end_date: parseCalendarDate(weekEnd),
  };
}
