export type CreditCardCycleTab = 'movimientos' | 'resumen' | 'cuotas';

export type SheetSnap = 'peek' | 'half' | 'full';

export const CREDIT_CARD_CYCLE_TABS: CreditCardCycleTab[] = [
  'movimientos',
  'resumen',
  'cuotas',
];

export const isCreditCardCycleTab = (value: string): value is CreditCardCycleTab =>
  CREDIT_CARD_CYCLE_TABS.includes(value as CreditCardCycleTab);
