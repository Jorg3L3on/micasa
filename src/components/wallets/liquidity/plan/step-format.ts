import { formatMonthShort } from '@/lib/calendar-dates';
import type { ActionInstance, ActionTypeId } from '@/lib/finance/cash-plan/types';

/** "Hoy", "Antes del 9 nov", or null when the step has no civil day. */
export const stepDateLabel = (dueDate: string | undefined, todayYmd: string): string | null => {
  if (!dueDate) return null;
  if (dueDate <= todayYmd.slice(0, 10)) return 'Hoy';
  const [, month, day] = dueDate.split('-').map(Number);
  return `Antes del ${day} ${formatMonthShort(month)}`;
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
