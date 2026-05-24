import { describe, expect, it } from 'vitest';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';

describe('getEffectiveCardPaymentAmount', () => {
  it('uses planned payment when set', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 4579.54,
        plannedPayment: 500,
      }),
    ).toBe(500);
  });

  it('falls back to suggested when plan is null', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 4579.54,
        plannedPayment: null,
      }),
    ).toBe(4579.54);
  });

  it('allows explicit zero plan', () => {
    expect(
      getEffectiveCardPaymentAmount({
        nextDuePayment: 1000,
        plannedPayment: 0,
      }),
    ).toBe(0);
  });
});
