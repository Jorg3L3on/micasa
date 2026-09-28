import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import {
  STATUS_BADGE_CLASS,
  STATUS_NEUTRAL_BADGE_CLASS,
  STATUS_SOFT_CLASS,
} from '@/lib/status-tone';

export type LoanPaymentVisualStatus =
  | 'paid'
  | 'skipped'
  | 'cancelled'
  | 'overdue'
  | 'scheduled';

export type LoanPaymentStatusTone = {
  icon: LucideIcon;
  /** Left accent only. Rows stay calm — no tinted fill. */
  row: string;
  badge: string;
  iconBox: string;
};

export const paymentStatusTone = (
  status: LoanPaymentVisualStatus,
): LoanPaymentStatusTone => {
  if (status === 'paid') {
    return {
      icon: CheckCircle2,
      row: 'border-l-[3px] border-l-status-success',
      badge: STATUS_BADGE_CLASS.success,
      iconBox: STATUS_SOFT_CLASS.success,
    };
  }
  if (status === 'overdue') {
    return {
      icon: AlertTriangle,
      row: 'border-l-[3px] border-l-status-overdue',
      badge: STATUS_BADGE_CLASS.overdue,
      iconBox: STATUS_SOFT_CLASS.overdue,
    };
  }
  if (status === 'skipped') {
    return {
      icon: CircleSlash,
      row: 'border-l-[3px] border-l-border',
      badge: STATUS_NEUTRAL_BADGE_CLASS,
      iconBox: 'bg-muted text-muted-foreground',
    };
  }
  if (status === 'cancelled') {
    return {
      icon: CircleSlash,
      row: 'border-l-[3px] border-l-status-expense',
      badge: STATUS_BADGE_CLASS.expense,
      iconBox: STATUS_SOFT_CLASS.expense,
    };
  }
  return {
    icon: Clock,
    row: 'border-l-[3px] border-l-status-pending',
    badge: STATUS_BADGE_CLASS.pending,
    iconBox: STATUS_SOFT_CLASS.pending,
  };
};
