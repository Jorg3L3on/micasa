export type CreditCardCycleTab = 'movimientos' | 'cuotas';

export const CREDIT_CARD_CYCLE_TABS: CreditCardCycleTab[] = [
  'movimientos',
  'cuotas',
];

export const isCreditCardCycleTab = (value: string): value is CreditCardCycleTab =>
  CREDIT_CARD_CYCLE_TABS.includes(value as CreditCardCycleTab);

/** Next cycle can be anchored whenever the open cycle has an end date. */
export const canAdvanceToNextCreditCardCycle = (
  currentCycleEnd: string | null | undefined,
): boolean => typeof currentCycleEnd === 'string' && currentCycleEnd.length > 0;
