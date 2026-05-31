export const getEffectiveCardPaymentAmount = (item: {
  nextDuePayment: number;
  plannedPayment?: number | null;
  paymentsAppliedToStatement?: number;
}): number =>
  item.plannedPayment != null
    ? Math.max(item.plannedPayment - (item.paymentsAppliedToStatement ?? 0), 0)
    : item.nextDuePayment;
