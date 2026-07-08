export const getEffectiveCardPaymentAmount = (item: {
  remainingPlannerAmount?: number;
  effectiveAmount?: number;
  nextDuePayment: number;
  plannedPayment?: number | null;
  paymentsAppliedToStatement?: number;
}): number => {
  if (item.remainingPlannerAmount != null) {
    return item.remainingPlannerAmount;
  }
  if (item.effectiveAmount != null) {
    return item.effectiveAmount;
  }
  return item.plannedPayment != null
    ? Math.max(item.plannedPayment - (item.paymentsAppliedToStatement ?? 0), 0)
    : item.nextDuePayment;
};
