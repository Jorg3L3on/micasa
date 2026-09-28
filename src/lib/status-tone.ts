/**
 * One class set per financial status. Pages use these instead of
 * emerald/rose/amber/violet/blue palette utilities.
 */

export type StatusTone =
  | 'success'
  | 'pending'
  | 'overdue'
  | 'income'
  | 'expense'
  | 'info';

export const STATUS_TEXT_CLASS: Record<StatusTone, string> = {
  success: 'text-status-success',
  pending: 'text-status-pending',
  overdue: 'text-status-overdue',
  income: 'text-status-income',
  expense: 'text-status-expense',
  info: 'text-status-info',
};

export const STATUS_FILL_CLASS: Record<StatusTone, string> = {
  success: 'bg-status-success',
  pending: 'bg-status-pending',
  overdue: 'bg-status-overdue',
  income: 'bg-status-income',
  expense: 'bg-status-expense',
  info: 'bg-status-info',
};

export const STATUS_SOFT_CLASS: Record<StatusTone, string> = {
  success: 'bg-status-success-soft text-status-success',
  pending: 'bg-status-pending-soft text-status-pending',
  overdue: 'bg-status-overdue-soft text-status-overdue',
  income: 'bg-status-income-soft text-status-income',
  expense: 'bg-status-expense-soft text-status-expense',
  info: 'bg-status-info-soft text-status-info',
};

export const STATUS_BADGE_CLASS: Record<StatusTone, string> = {
  success:
    'border border-status-success-border bg-status-success-soft text-status-success',
  pending:
    'border border-status-pending-border bg-status-pending-soft text-status-pending',
  overdue:
    'border border-status-overdue-border bg-status-overdue-soft text-status-overdue',
  income:
    'border border-status-income-border bg-status-income-soft text-status-income',
  expense:
    'border border-status-expense-border bg-status-expense-soft text-status-expense',
  info: 'border border-status-info-border bg-status-info-soft text-status-info',
};

export const STATUS_NEUTRAL_BADGE_CLASS =
  'border border-border bg-muted text-muted-foreground';
