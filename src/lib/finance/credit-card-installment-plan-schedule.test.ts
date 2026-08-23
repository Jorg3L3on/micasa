import { describe, expect, it } from 'vitest';
import {
  defaultNextDueDateForCard,
  generateInstallmentPlanPayments,
} from '@/lib/finance/credit-card-installment-plan-schedule';

describe('generateInstallmentPlanPayments', () => {
  it('marks past installments paid and schedules the rest from next due date', () => {
    const payments = generateInstallmentPlanPayments({
      installmentAmount: 1500,
      totalInstallments: 9,
      paidInstallments: 2,
      nextDueDate: '2026-03-15',
    });

    expect(payments).toHaveLength(9);
    expect(payments[0]).toMatchObject({ sequence: 1, status: 'PAID' });
    expect(payments[1]).toMatchObject({ sequence: 2, status: 'PAID' });
    expect(payments[2]).toMatchObject({
      sequence: 3,
      status: 'SCHEDULED',
      amount: 1500,
    });
    expect(payments[8]).toMatchObject({ sequence: 9, status: 'SCHEDULED' });
    expect(payments[2]!.dueDate.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(payments[3]!.dueDate.toISOString().slice(0, 10)).toBe('2026-04-15');
  });
});

describe('defaultNextDueDateForCard', () => {
  it('uses due day in current month when still ahead', () => {
    expect(defaultNextDueDateForCard(15, '2026-03-10')).toBe('2026-03-15');
  });

  it('rolls to next month after due day passed', () => {
    expect(defaultNextDueDateForCard(15, '2026-03-20')).toBe('2026-04-15');
  });
});
