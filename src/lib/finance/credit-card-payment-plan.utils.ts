export const getEffectiveCardPaymentAmount = (item: {
  remainingPlannerAmount?: number;
  effectiveAmount?: number;
  nextDuePayment: number;
  plannedPayment?: number | null;
  paymentsAppliedToFortnight?: number;
  paymentsAppliedToStatement?: number;
}): number => {
  if (item.remainingPlannerAmount != null) {
    return item.remainingPlannerAmount;
  }
  if (item.effectiveAmount != null) {
    return item.effectiveAmount;
  }
  // Legacy fallback: treat non-positive plans as absent.
  if (item.plannedPayment != null && item.plannedPayment > 0) {
    const paid =
      item.paymentsAppliedToFortnight ??
      item.paymentsAppliedToStatement ??
      0;
    return Math.max(item.plannedPayment - paid, 0);
  }
  return item.nextDuePayment;
};
