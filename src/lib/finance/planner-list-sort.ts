import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import type { DuePaymentItem, PlannerCardPaymentStatusUi } from '@/types/catalog';
import type { LoanDuePaymentItem, LoanPaymentStatusValue } from '@/types/loans';

/** Shared sort modes for Gastos / Tarjeta / Préstamos in planificación. */
export type PlannerListSortMode = 'amount' | 'due_day';
export type PlannerListSortDir = 'asc' | 'desc';

export type PlannerListSortPreference = {
  mode: PlannerListSortMode;
  dir: PlannerListSortDir;
};

/** @deprecated Use PlannerListSortMode */
export type ExpenseListSortMode = PlannerListSortMode;

export const PLANNER_LIST_SORT_STORAGE_KEY = 'micasa.planificacion.listSort';
/** Legacy key from when sort was gastos-only (mode string only). */
export const PLANNER_LIST_SORT_STORAGE_KEY_LEGACY =
  'micasa.planificacion.expenseSort';

export const EXPENSE_LIST_SORT_STORAGE_KEY = PLANNER_LIST_SORT_STORAGE_KEY;

/** Field labels in the sort menu (direction shown with arrows). */
export const PLANNER_LIST_SORT_FIELD_LABELS: Record<
  PlannerListSortMode,
  string
> = {
  amount: 'Monto',
  due_day: 'Día de pago',
};

/** Human label reflecting current mode + direction. */
export const plannerListSortDisplayLabel = (
  mode: PlannerListSortMode,
  dir: PlannerListSortDir,
): string => {
  if (mode === 'amount') {
    return dir === 'desc' ? 'Mayor monto' : 'Menor monto';
  }
  return dir === 'asc' ? 'Día más cercano' : 'Día más lejano';
};

/** @deprecated Prefer PLANNER_LIST_SORT_FIELD_LABELS + display label */
export const PLANNER_LIST_SORT_LABELS = PLANNER_LIST_SORT_FIELD_LABELS;
export const EXPENSE_LIST_SORT_LABELS = PLANNER_LIST_SORT_FIELD_LABELS;

export const isPlannerListSortMode = (
  value: string | null | undefined,
): value is PlannerListSortMode =>
  value === 'amount' || value === 'due_day';

export const isPlannerListSortDir = (
  value: string | null | undefined,
): value is PlannerListSortDir => value === 'asc' || value === 'desc';

export const isExpenseListSortMode = isPlannerListSortMode;

export const defaultDirForMode = (
  mode: PlannerListSortMode,
): PlannerListSortDir => (mode === 'due_day' ? 'asc' : 'desc');

export const nextPlannerListSortPreference = (
  current: PlannerListSortPreference,
  nextMode: PlannerListSortMode,
): PlannerListSortPreference => {
  if (current.mode === nextMode) {
    return {
      mode: nextMode,
      dir: current.dir === 'asc' ? 'desc' : 'asc',
    };
  }
  return { mode: nextMode, dir: defaultDirForMode(nextMode) };
};

export const readPlannerListSortPreference = (): PlannerListSortPreference => {
  if (typeof window === 'undefined') {
    return { mode: 'amount', dir: 'desc' };
  }
  try {
    const raw =
      localStorage.getItem(PLANNER_LIST_SORT_STORAGE_KEY) ??
      localStorage.getItem(PLANNER_LIST_SORT_STORAGE_KEY_LEGACY);
    if (!raw) return { mode: 'amount', dir: 'desc' };

    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as Partial<PlannerListSortPreference>;
      if (isPlannerListSortMode(parsed.mode)) {
        const dir = isPlannerListSortDir(parsed.dir)
          ? parsed.dir
          : defaultDirForMode(parsed.mode);
        return { mode: parsed.mode, dir };
      }
    }

    if (isPlannerListSortMode(raw)) {
      return { mode: raw, dir: defaultDirForMode(raw) };
    }
  } catch {
    /* ignore */
  }
  return { mode: 'amount', dir: 'desc' };
};

/** @deprecated Use readPlannerListSortPreference */
export const readPlannerListSortMode = (): PlannerListSortMode =>
  readPlannerListSortPreference().mode;

export const writePlannerListSortPreference = (
  preference: PlannerListSortPreference,
): void => {
  try {
    localStorage.setItem(
      PLANNER_LIST_SORT_STORAGE_KEY,
      JSON.stringify(preference),
    );
  } catch {
    /* ignore */
  }
};

/** @deprecated Use writePlannerListSortPreference */
export const writePlannerListSortMode = (mode: PlannerListSortMode): void => {
  writePlannerListSortPreference({
    mode,
    dir: defaultDirForMode(mode),
  });
};

type SortableExpenseRow = {
  is_paid: boolean;
  amount: number | string;
  due_day?: number | null;
};

const dueDayRank = (dueDay: number | null | undefined): number => {
  if (dueDay == null || Number.isNaN(Number(dueDay))) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(dueDay);
};

const dirSign = (dir: PlannerListSortDir): number => (dir === 'asc' ? 1 : -1);

/**
 * Unpaid first, then by mode + direction.
 * Missing due days stay last among unpaid regardless of direction.
 */
export const sortExpenseListRows = <T extends SortableExpenseRow>(
  rows: T[],
  mode: PlannerListSortMode,
  dir: PlannerListSortDir = defaultDirForMode(mode),
): T[] =>
  [...rows].sort((a, b) => {
    if (a.is_paid !== b.is_paid) {
      return a.is_paid ? 1 : -1;
    }

    if (mode === 'due_day') {
      const dueA = dueDayRank(a.due_day);
      const dueB = dueDayRank(b.due_day);
      const aMissing = !Number.isFinite(dueA);
      const bMissing = !Number.isFinite(dueB);
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
      if (dueA !== dueB) {
        return dirSign(dir) * (dueA - dueB);
      }
    }

    return dirSign(dir) * (Number(a.amount) - Number(b.amount));
  });

const cardStatusRank = (status: PlannerCardPaymentStatusUi | undefined): number => {
  const s = status ?? 'por_pagar';
  if (s === 'vencido') return 0;
  if (s === 'por_pagar') return 1;
  if (s === 'pagado') return 2;
  return 3;
};

const cardDueKey = (item: DuePaymentItem): string =>
  item.visibleDueDate || item.statementDueDate || '';

/**
 * Pending/overdue first (status), then by mode + direction.
 */
export const sortCardDuePaymentRows = (
  items: DuePaymentItem[],
  mode: PlannerListSortMode,
  dir: PlannerListSortDir = defaultDirForMode(mode),
): DuePaymentItem[] =>
  [...items].sort((a, b) => {
    const byStatus =
      cardStatusRank(a.plannerStatus) - cardStatusRank(b.plannerStatus);
    if (byStatus !== 0) return byStatus;

    if (mode === 'due_day') {
      const dueCmp = cardDueKey(a).localeCompare(cardDueKey(b));
      if (dueCmp !== 0) return dirSign(dir) * dueCmp;
    }

    return (
      dirSign(dir) *
      (getEffectiveCardPaymentAmount(a) - getEffectiveCardPaymentAmount(b))
    );
  });

type LoanVisualStatus = 'paid' | 'overdue' | 'pending' | 'muted';

const loanVisualStatus = (
  item: {
    status: LoanPaymentStatusValue;
    dueDate: string;
  },
  todayYmd: string,
): LoanVisualStatus => {
  if (item.status === 'PAID') return 'paid';
  if (item.status === 'CANCELLED' || item.status === 'SKIPPED') return 'muted';
  if (item.dueDate < todayYmd) return 'overdue';
  return 'pending';
};

const loanStatusRank = (visual: LoanVisualStatus): number => {
  if (visual === 'overdue') return 0;
  if (visual === 'pending') return 1;
  if (visual === 'paid') return 2;
  return 3;
};

/**
 * Overdue/pending first (status), then by mode + direction.
 */
export const sortLoanDuePaymentRows = (
  items: LoanDuePaymentItem[],
  mode: PlannerListSortMode,
  dir: PlannerListSortDir = defaultDirForMode(mode),
  todayYmd: string,
): LoanDuePaymentItem[] =>
  [...items].sort((a, b) => {
    const byStatus =
      loanStatusRank(loanVisualStatus(a, todayYmd)) -
      loanStatusRank(loanVisualStatus(b, todayYmd));
    if (byStatus !== 0) return byStatus;

    if (mode === 'due_day') {
      const dueCmp = a.dueDate.localeCompare(b.dueDate);
      if (dueCmp !== 0) return dirSign(dir) * dueCmp;
    }

    return dirSign(dir) * (Number(a.amount) - Number(b.amount));
  });
