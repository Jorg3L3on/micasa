import { describe, expect, it } from 'vitest';
import { paymentPlanFortnightKeys } from '@/lib/finance/card-payment-plan-fortnights';

describe('paymentPlanFortnightKeys', () => {
  it('includes the open statement due fortnight when it is already behind the current quincena', () => {
    const keys = paymentPlanFortnightKeys({
      now: new Date('2026-09-24T18:00:00.000Z'),
      cutoffDay: 12,
      dueDay: 13,
    });

    expect(keys).toEqual(
      expect.arrayContaining([
        { year: 2026, month: 9, period: 'FIRST' },
        { year: 2026, month: 10, period: 'FIRST' },
      ]),
    );
    expect(keys).toHaveLength(2);
  });

  it('does not duplicate a due fortnight that is already current or next', () => {
    const keys = paymentPlanFortnightKeys({
      now: new Date('2026-09-10T18:00:00.000Z'),
      cutoffDay: 12,
      dueDay: 13,
    });

    const septemberFirst = keys.filter(
      (key) => key.year === 2026 && key.month === 9 && key.period === 'FIRST',
    );
    expect(septemberFirst).toHaveLength(1);
  });
});
