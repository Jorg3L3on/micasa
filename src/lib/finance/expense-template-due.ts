/**
 * Per-quincena due days on ExpenseTemplate + legacy `due_day` fallback.
 */

export type ExpenseTemplateDueFields = {
  due_day: number | null;
  due_day_first_fortnight: number | null;
  due_day_second_fortnight: number | null;
};

export const resolveTemplateDueDay = (
  period: 'FIRST' | 'SECOND',
  t: ExpenseTemplateDueFields,
): number | undefined => {
  if (period === 'FIRST') {
    return t.due_day_first_fortnight ?? t.due_day ?? undefined;
  }
  return t.due_day_second_fortnight ?? t.due_day ?? undefined;
};

/** Single `dueDay` for list/API compatibility: first non-null specific, then legacy. */
export const deriveLegacyDueDayForTemplate = (
  t: ExpenseTemplateDueFields,
): number | null =>
  t.due_day_first_fortnight ??
  t.due_day_second_fortnight ??
  t.due_day ??
  null;
