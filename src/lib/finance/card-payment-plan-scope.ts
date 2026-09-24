import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import {
  lastPlannedOverrideDecision,
  type PlannedOverrideStamp,
} from '@/lib/finance/card-period-obligation';
import { resolveCreditCardStatementWindow } from '@/lib/finance/card-statement-obligation';

/** API / UI scope. Null in storage means this_cycle. */
export type CardPaymentPlanScopeKind = 'this_cycle' | 'n_cycles' | 'until_date';

export type StatementCycleRef = {
  statementEnd: string;
  statementDueDate: string;
};

export type StoredPaymentPlanWrite = PlannedOverrideStamp & {
  scope?: CardPaymentPlanScopeKind | null;
  cycleCount?: number | null;
  /** YYYY-MM-DD. Cycles with a due date after this day are outside until_date. */
  validUntil?: string | null;
  /** Statement end the write is anchored to. Derived from the fortnight when null. */
  anchorStatementEnd?: string | null;
  fortnightYear?: number | null;
  fortnightMonth?: number | null;
};

const clampDayToMonth = (year: number, month: number, day: number) =>
  Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate());

export const normalizePlanScope = (
  value: string | null | undefined,
): CardPaymentPlanScopeKind => {
  if (value === 'n_cycles' || value === 'N_CYCLES') return 'n_cycles';
  if (value === 'until_date' || value === 'UNTIL_DATE') return 'until_date';
  return 'this_cycle';
};

/**
 * Both fortnights of a month share the card's corte for that month.
 * The period does not create a second cycle.
 */
export const statementCycleForFortnight = (
  year: number,
  month: number,
  _period: 'FIRST' | 'SECOND',
  cutoffDay: number,
  dueDay: number,
): StatementCycleRef => statementCycleForMonth(year, month, cutoffDay, dueDay);

/** Statement cycle for a calendar month, shared by both fortnights of that month. */
export const statementCycleForMonth = (
  year: number,
  month: number,
  cutoffDay: number,
  dueDay: number,
): StatementCycleRef => {
  const day = clampDayToMonth(year, month, dueDay);
  const asOf = parseCalendarDate(
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
  return statementCycleForDate(asOf, cutoffDay, dueDay);
};

export const statementCycleForDate = (
  asOf: Date,
  cutoffDay: number,
  dueDay: number,
): StatementCycleRef => {
  const window = resolveCreditCardStatementWindow(asOf, cutoffDay, dueDay);
  return {
    statementEnd: formatCalendarDate(window.statementEnd),
    statementDueDate: formatCalendarDate(window.statementDueDate),
  };
};

/** Whole months from the anchor corte to the target corte. Negative means the target is earlier. */
export const statementCycleOffset = (
  anchorStatementEnd: string,
  targetStatementEnd: string,
): number => {
  const [anchorYear, anchorMonth] = anchorStatementEnd.split('-').map(Number);
  const [targetYear, targetMonth] = targetStatementEnd.split('-').map(Number);
  return (targetYear - anchorYear) * 12 + (targetMonth - anchorMonth);
};

const resolveAnchor = (
  write: StoredPaymentPlanWrite,
  cutoffDay: number,
  dueDay: number,
): StatementCycleRef | null => {
  if (write.anchorStatementEnd) {
    return statementCycleForDate(
      parseCalendarDate(write.anchorStatementEnd),
      cutoffDay,
      dueDay,
    );
  }
  if (write.fortnightYear != null && write.fortnightMonth != null) {
    return statementCycleForMonth(
      write.fortnightYear,
      write.fortnightMonth,
      cutoffDay,
      dueDay,
    );
  }
  return null;
};

export const writeCoversCycle = (
  write: StoredPaymentPlanWrite,
  target: StatementCycleRef,
  card: { cutoffDay: number; dueDay: number },
): boolean => {
  const anchor = resolveAnchor(write, card.cutoffDay, card.dueDay);
  // Rows loaded without a fortnight or anchor cannot name a corte. A this_cycle
  // write still applies to the period being read; wider scopes do not.
  if (anchor == null) return normalizePlanScope(write.scope) === 'this_cycle';
  const offset = statementCycleOffset(anchor.statementEnd, target.statementEnd);
  if (offset < 0) return false;
  const scope = normalizePlanScope(write.scope);
  if (scope === 'this_cycle') return offset === 0;
  if (scope === 'n_cycles') {
    const count = write.cycleCount != null && write.cycleCount > 0 ? write.cycleCount : 1;
    return offset < count;
  }
  if (!write.validUntil) return offset === 0;
  return target.statementDueDate <= write.validUntil;
};

export type PaymentPlanRowLike = {
  planned_amount: { toString(): string } | number | string;
  declared_zero: boolean;
  scope?: string | null;
  cycle_count?: number | null;
  valid_until?: Date | null;
  anchor_statement_end?: Date | null;
  updated_at?: Date | null;
  created_at?: Date | null;
  fortnight?: { year: number; month: number } | null;
};

export const toStoredPaymentPlanWrite = (
  plan: PaymentPlanRowLike,
): StoredPaymentPlanWrite => ({
  amount: Number(plan.planned_amount),
  declaredZero: plan.declared_zero === true,
  scope: plan.scope == null ? 'this_cycle' : normalizePlanScope(plan.scope),
  cycleCount: plan.cycle_count ?? null,
  validUntil: plan.valid_until ? formatCalendarDate(plan.valid_until) : null,
  anchorStatementEnd: plan.anchor_statement_end
    ? formatCalendarDate(plan.anchor_statement_end)
    : null,
  fortnightYear: plan.fortnight?.year ?? null,
  fortnightMonth: plan.fortnight?.month ?? null,
  updatedAt: plan.updated_at ?? null,
  createdAt: plan.created_at ?? null,
});

export type ActivePlannedOverride = {
  plannedOverride: number | null;
  explicitZero: boolean;
  scope: CardPaymentPlanScopeKind | null;
  cycleCount: number | null;
  validUntil: string | null;
};

const emptyOverride = (): ActivePlannedOverride => ({
  plannedOverride: null,
  explicitZero: false,
  scope: null,
  cycleCount: null,
  validUntil: null,
});

/**
 * Override in force for a statement cycle. Last updatedAt/createdAt wins.
 * Passed to `resolveCardPeriodObligation` as `plannedOverride`.
 */
export const selectActivePlannedOverride = (
  writes: readonly StoredPaymentPlanWrite[],
  target: StatementCycleRef,
  card: { cutoffDay: number; dueDay: number },
): ActivePlannedOverride => {
  const covering = writes.filter((write) => writeCoversCycle(write, target, card));
  if (covering.length === 0) return emptyOverride();
  const decision = lastPlannedOverrideDecision(covering);
  const millis = (value: Date | string | number | null | undefined) => {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const ordered = [...covering].sort((a, b) => {
    const updated = millis(a.updatedAt) - millis(b.updatedAt);
    if (updated !== 0) return updated;
    return millis(a.createdAt) - millis(b.createdAt);
  });
  const winner = ordered[ordered.length - 1];
  return {
    plannedOverride: decision.amount,
    explicitZero: decision.declaredZero,
    scope: normalizePlanScope(winner.scope),
    cycleCount: winner.cycleCount ?? null,
    validUntil: winner.validUntil ?? null,
  };
};
