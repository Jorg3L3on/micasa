import { describe, expect, it } from 'vitest';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

describe('getEffectiveCardPaymentAmount', () => {
  it('uses planned payment when set (legacy fallback)', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 4500,
        plannedPayment: 500,
      }),
    ).toBe(500);
  });

  it('uses remainingPlannerAmount when provided', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 3800,
        remainingPlannerAmount: 0,
        plannedPayment: 700,
        paymentsAppliedToStatement: 0,
      }),
    ).toBe(0);
  });

  it('subtracts fortnight payments from a planned payment (legacy fallback)', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 3800,
        plannedPayment: 700,
        paymentsAppliedToFortnight: 700,
      }),
    ).toBe(0);
  });

  it('falls back to the corte figure when no plan is set', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 1500,
        plannedPayment: null,
      }),
    ).toBe(1500);
  });

  it('ignores a non-positive plan and keeps the corte figure', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 1000,
        plannedPayment: 0,
      }),
    ).toBe(1000);
  });
});
