export type CreditCardCycleTab = 'movimientos' | 'cuotas';

export const CREDIT_CARD_CYCLE_TABS: CreditCardCycleTab[] = [
  'movimientos',
  'cuotas',
];

export const isCreditCardCycleTab = (value: string): value is CreditCardCycleTab =>
  CREDIT_CARD_CYCLE_TABS.includes(value as CreditCardCycleTab);
