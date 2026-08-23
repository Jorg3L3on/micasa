import type { CreditCardInstallmentPlanItem } from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';

export type InstallmentPlanFormValues = {
  name: string;
  installmentAmount: number;
  totalInstallments: string;
  paidInstallments: string;
  nextDueDate: string;
  alreadyInBalance: boolean;
};

/** Create-mode defaults (empty name, 0 amount, 9 months, 0 paid). */
export const CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS: Omit<
  InstallmentPlanFormValues,
  'nextDueDate'
> = {
  name: '',
  installmentAmount: 0,
  totalInstallments: '9',
  paidInstallments: '0',
  alreadyInBalance: true,
};

export const defaultNextDueDate = (
  dueDay: number | null | undefined,
): string => {
  const today = todayCalendarDate();
  if (dueDay == null || dueDay < 1) return today;
  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(dueDay, lastDay);
  if (day <= clamped) {
    return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
  }
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextLast = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const nextClamped = Math.min(dueDay, nextLast);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextClamped).padStart(2, '0')}`;
};

/**
 * Synchronous form values for create vs edit.
 * Call at mount (with a stable `key` on the dialog) so edit never paints create defaults.
 */
export const getInstallmentPlanFormValues = (
  plan: CreditCardInstallmentPlanItem | null | undefined,
  defaultDueDay?: number | null,
): InstallmentPlanFormValues => {
  if (plan) {
    return {
      name: plan.name,
      installmentAmount: plan.installmentAmount,
      totalInstallments: String(plan.totalInstallments),
      paidInstallments: String(plan.paidInstallments),
      nextDueDate: plan.nextDueDate ?? defaultNextDueDate(defaultDueDay),
      alreadyInBalance: plan.alreadyInCardBalance,
    };
  }

  return {
    ...CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS,
    nextDueDate: defaultNextDueDate(defaultDueDay),
  };
};
