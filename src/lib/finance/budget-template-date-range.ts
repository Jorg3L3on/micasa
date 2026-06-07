import {
  addCalendarDays,
  endOfCalendarDay,
  startOfCalendarDay,
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

export function computeBudgetTemplateDateRange({
  frequency,
  now = new Date(),
  currentFortnight,
  customStartDate,
  customEndDate,
}: BudgetTemplateDateRangeInput): { start_date: Date | null; end_date: Date | null } {
  if (frequency === 'CUSTOM') {
    return {
      start_date: customStartDate ? new Date(customStartDate) : null,
      end_date: customEndDate ? new Date(customEndDate) : null,
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
    return {
      start_date: startOfCalendarDay(today),
      end_date: endOfCalendarDay(today),
    };
  }

  const [year, month, day] = today.split('-').map(Number);
  const weekStart = addCalendarDays(
    today,
    -new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay(),
  );
  const weekEnd = addCalendarDays(weekStart, 6);

  return {
    start_date: startOfCalendarDay(weekStart),
    end_date: endOfCalendarDay(weekEnd),
  };
}
