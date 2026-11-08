import { toCents } from '@/lib/finance/cash-plan/money';
import type { ActionInstance, ActionTypeId, Obligation } from '@/lib/finance/cash-plan/types';

/**
 * Pure part of "Activar este plan": which step becomes which write. Shared by
 * the server (apply-plan.service) and the confirmation sheet, so the sheet
 * lists the same writes the route makes.
 */

export type AppliedWrite =
  | {
    kind: 'card_payment_plan';
    walletId: number;
    label: string;
    fortnightId: number;
    amount: number;
    /** `unchanged`: a plan row with this amount already existed; nothing was written. */
    status: 'created' | 'updated' | 'unchanged';
  }
  | {
    kind: 'loan_abono_planned';
    loanId: number;
    label: string;
    fortnightId: number;
    expenseId: number;
    amount: number;
    /** `unchanged`: the planned abono already existed with this amount. */
    status: 'created' | 'updated' | 'unchanged';
  }
  | {
    kind: 'expense_moved';
    expenseId: number;
    label: string;
    fromFortnightId: number;
    toFortnightId: number;
  };

export type SkippedAction = {
  type: ActionInstance['type'];
  label: string;
  reason: string;
};

export type ApplyPlanResult = {
  writes: AppliedWrite[];
  skipped: SkippedAction[];
};

export const NO_WRITE_REASON: Partial<Record<ActionTypeId, string>> = {
  buffer_reserve: 'Se queda en tu cuenta; no hay nada que programar.',
  pay_msi_installment: 'La mensualidad ya va en el corte de su tarjeta.',
  bridge_loan: 'Es una simulación. Si lo contratas, regístralo en Préstamos.',
  consolidate: 'Es una simulación. Si lo contratas, regístralo en Préstamos.',
};

export const CARD_ACTIONS = new Set<ActionTypeId>([
  'pay_minimum',
  'pay_statement',
  'pay_off',
  'extra_to_debt_avalanche',
  'extra_to_debt_snowball',
]);

const EXTRA_ACTIONS = new Set<ActionTypeId>(['extra_to_debt_avalanche', 'extra_to_debt_snowball']);

export const cardWalletId = (obligationId: string | undefined | null): number | null => {
  const match = /^card-(\d+)$/.exec(obligationId ?? '');
  return match ? Number(match[1]) : null;
};

export type CardPlanDraft = {
  walletId: number;
  label: string;
  dueDate?: string;
  amountCents: number;
};

/**
 * One planned payment per card: the step's amount for a minimum, statement
 * or payoff; for an extra abono alone, what is due on that card plus the extra.
 */
export const collectCardPlans = (
  actions: readonly ActionInstance[],
  obligations: readonly Obligation[],
): CardPlanDraft[] => {
  const plans = new Map<number, CardPlanDraft & { types: Set<ActionTypeId> }>();
  for (const step of actions) {
    if (!CARD_ACTIONS.has(step.type)) continue;
    const walletId = cardWalletId(step.obligationId);
    if (walletId == null || step.amount == null || step.amount <= 0) continue;
    const obligation = obligations.find((item) => item.id === step.obligationId);
    const current = plans.get(walletId) ?? {
      walletId,
      label: obligation?.labelSynthetic ?? step.label,
      dueDate: step.dueDate,
      amountCents: 0,
      types: new Set<ActionTypeId>(),
    };
    current.dueDate ??= step.dueDate;
    current.types.add(step.type);
    current.amountCents += toCents(step.amount);
    plans.set(walletId, current);
  }
  return [...plans.values()].map(({ types, ...plan }) => {
    const onlyExtra = [...types].every((type) => EXTRA_ACTIONS.has(type));
    if (!onlyExtra) return plan;
    const obligation = obligations.find((item) => item.id === `card-${plan.walletId}`);
    const due = obligation?.dueInHorizon ? toCents(obligation.statementDue ?? 0) : 0;
    return { ...plan, amountCents: plan.amountCents + due };
  });
};

export const loanId = (obligationId: string | undefined | null): number | null => {
  const match = /^loan-(\d+)$/.exec(obligationId ?? '');
  return match ? Number(match[1]) : null;
};

/** Loan steps that become a planned abono: an extra or a payoff (installments are already scheduled). */
const LOAN_ABONO_ACTIONS = new Set<ActionTypeId>(['extra_to_debt_avalanche', 'extra_to_debt_snowball', 'pay_off']);

export type LoanAbonoDraft = {
  loanId: number;
  label: string;
  /** Text of the planned expense; also its key for idempotency. */
  description: string;
  dueDate?: string;
  fromWalletId?: number;
  amountCents: number;
};

/**
 * One planned abono per loan: an unpaid expense in the step's quincena, on
 * the source wallet. It reminds; it charges nothing by itself.
 */
export const collectLoanAbonos = (
  actions: readonly ActionInstance[],
  obligations: readonly Obligation[],
): LoanAbonoDraft[] => {
  const abonos = new Map<number, LoanAbonoDraft>();
  for (const step of actions) {
    if (!LOAN_ABONO_ACTIONS.has(step.type)) continue;
    const id = loanId(step.obligationId);
    if (id == null || step.amount == null || step.amount <= 0) continue;
    const label = obligations.find((item) => item.id === step.obligationId)?.labelSynthetic ?? step.label;
    const current = abonos.get(id) ?? {
      loanId: id,
      label,
      description: `${step.type === 'pay_off' ? 'Liquidar' : 'Abono extra'} · ${label}`,
      dueDate: step.dueDate,
      fromWalletId: step.fromWalletId,
      amountCents: 0,
    };
    current.dueDate ??= step.dueDate;
    current.fromWalletId ??= step.fromWalletId;
    current.amountCents += toCents(step.amount);
    abonos.set(id, current);
  }
  return [...abonos.values()];
};

/** Why a step writes nothing, or null when it maps to a write. */
export const noWriteReason = (step: Pick<ActionInstance, 'type' | 'obligationId'>): string | null => {
  const fixed = NO_WRITE_REASON[step.type];
  if (fixed) return fixed;
  if (loanId(step.obligationId) != null) {
    return LOAN_ABONO_ACTIONS.has(step.type) ? null : 'Las cuotas del préstamo ya están en su calendario.';
  }
  if (CARD_ACTIONS.has(step.type) && cardWalletId(step.obligationId) == null) {
    return 'Este paso no tiene una tarjeta a la cual programar el pago.';
  }
  if (step.type === 'split_hybrid') return 'Ajusta este paso a mano en tu Panel.';
  return null;
};
