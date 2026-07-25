import { describe, expect, it } from 'vitest';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

describe('getEffectiveCardPaymentAmount', () => {
  it('uses planned payment when set (legacy fallback)', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 4579.54,
        plannedPayment: 500,
      }),
    ).toBe(500);
  });

  it('uses remainingPlannerAmount when provided', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 3884.78,
        remainingPlannerAmount: 0,
        plannedPayment: 694.76,
        paymentsAppliedToStatement: 0,
      }),
    ).toBe(0);
  });

  it('subtracts fortnight payments from a planned payment (legacy fallback)', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 3884.78,
        plannedPayment: 694.76,
        paymentsAppliedToFortnight: 694.76,
      }),
    ).toBe(0);
  });

  it('falls back to suggested when plan is null', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 4579.54,
        plannedPayment: null,
      }),
    ).toBe(4579.54);
  });

  it('ignores non-positive plans and uses suggested due', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 1000,
        plannedPayment: 0,
      }),
    ).toBe(1000);
  });
});
