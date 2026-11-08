import { formatMonthShort } from '@/lib/calendar-dates';
import type { ActionInstance, ActionTypeId } from '@/lib/finance/cash-plan/types';

export type StepIncome = { date: string; title: string };

const dayMonth = (ymd: string): string => {
  const [, month, day] = ymd.split('-').map(Number);
  return `${day} ${formatMonthShort(month)}`;
};

const paydayPhrase = (title: string): string =>
  /n[oó]mina/i.test(title) ? 'al caer la nómina' : 'al caer tu ingreso';

/** Steps that can wait for money coming in: they have no bill date of their own. */
const PAYDAY_STEPS = new Set<ActionInstance['type']>([
  'buffer_reserve',
  'extra_to_debt_avalanche',
  'extra_to_debt_snowball',
]);

/**
 * Step date: "Hoy", "Antes del 9 nov", "14 nov · al caer la nómina" when an
 * income lands that day (or, for a step with no bill date, on the next
 * payday in the period), or null when there is nothing to date it by.
 * `incomes` are the period's expected incomes, sorted by date.
 */
export const stepDateLabel = (
  dueDate: string | undefined,
  todayYmd: string,
  incomes: readonly StepIncome[] = [],
  type?: ActionInstance['type'],
): string | null => {
  const today = todayYmd.slice(0, 10);
  if (dueDate) {
    const payday = incomes.find((income) => income.date === dueDate);
    if (payday) return `${dayMonth(dueDate)} · ${paydayPhrase(payday.title)}`;
    if (dueDate <= today) return 'Hoy';
    return `Antes del ${dayMonth(dueDate)}`;
  }
  if (type && PAYDAY_STEPS.has(type)) {
    const next = incomes.find((income) => income.date >= today);
    if (next) return `${dayMonth(next.date)} · ${paydayPhrase(next.title)}`;
  }
  return null;
};

/** Day a step sorts by: its bill date, the payday it waits for, or last. */
export const stepSortDate = (
  dueDate: string | undefined,
  todayYmd: string,
  incomes: readonly StepIncome[] = [],
  type?: ActionInstance['type'],
): string => {
  if (dueDate) return dueDate;
  if (type && PAYDAY_STEPS.has(type)) {
    const next = incomes.find((income) => income.date >= todayYmd.slice(0, 10));
    if (next) return next.date;
  }
  return '9999-12-31';
};

export type StepButton = { label: string; href: string };

const BUTTON_LABEL: Partial<Record<ActionTypeId, string>> = {
  pay_minimum: 'Programar pago',
  pay_statement: 'Programar pago',
  pay_msi_installment: 'Programar pago',
  pay_off: 'Programar pago',
  split_hybrid: 'Programar pago',
  extra_to_debt_avalanche: 'Programar pago',
  extra_to_debt_snowball: 'Programar pago',
  defer_nonessential: 'Mover',
  bridge_loan: 'Registrar préstamo',
  consolidate: 'Registrar préstamo',
};

/** Where a step's one action button leads; null for a step with nothing to do (the cushion). */
export const stepButton = (step: ActionInstance, monthlyPanelHref: string): StepButton | null => {
  const label = BUTTON_LABEL[step.type];
  if (!label) return null;
  const id = step.obligationId ?? '';
  const card = /^card-(\d+)$/.exec(id);
  if (step.type === 'bridge_loan' || step.type === 'consolidate' || id.startsWith('loan-')) {
    return { label, href: '/loans' };
  }
  if (card) return { label, href: `/credit-cards/${card[1]}` };
  if (id.startsWith('msi-')) return { label, href: '/credit-cards' };
  return { label, href: monthlyPanelHref };
};
