export const getEffectiveCardPaymentAmount = (item: {
  nextDuePayment: number;
  plannedPayment?: number | null;
}): number => (item.plannedPayment != null ? item.plannedPayment : item.nextDuePayment);
