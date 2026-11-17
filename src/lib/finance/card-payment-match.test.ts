import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';

vi.mock('@/lib/prisma', () => ({ default: {} }));

import {
  cardPaymentMatchWindow,
  pickCardPaymentMatch,
} from '@/lib/finance/card-payment-match';
import { coverInstallmentPlanPaymentForCardPayment } from '@/lib/finance/credit-card-installment-plan.service';
import { coverScheduledPaymentForCardPayment } from '@/lib/finance/credit-card-scheduled-payment.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

describe('pickCardPaymentMatch', () => {
  const rows = [
    { id: 1, amount: 1000 },
    { id: 2, amount: 250 },
    { id: 3, amount: 400 },
  ];

  it('prefers the exact amount over an earlier row', () => {
    expect(pickCardPaymentMatch(rows, 400)?.id).toBe(3);
  });

  it('falls back to the earliest row the payment covers', () => {
    expect(pickCardPaymentMatch(rows, 500)?.id).toBe(2);
    expect(pickCardPaymentMatch(rows, 5000)?.id).toBe(1);
  });

  it('matches nothing when the payment is smaller than every row', () => {
    expect(pickCardPaymentMatch(rows, 100)).toBeNull();
  });

  it('compares in cents', () => {
    expect(pickCardPaymentMatch([{ id: 9, amount: 0.3 }], 0.1 + 0.2)?.id).toBe(9);
  });
});

describe('cardPaymentMatchWindow', () => {
  it('spans ±7 calendar days as stored calendar instants', () => {
    expect(cardPaymentMatchWindow('2026-03-03')).toEqual({
      gte: parseCalendarDate('2026-02-24'),
      lte: parseCalendarDate('2026-03-10'),
    });
  });
});

describe('coverInstallmentPlanPaymentForCardPayment', () => {
  const makeTx = (candidates: { id: number; amount: number }[]) => ({
    creditCardInstallmentPlanPayment: {
      findMany: vi.fn(async () => candidates),
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) => ({
        id: where.id,
        plan_id: 50,
        status: 'SCHEDULED',
        plan: { id: 50, total_installments: 6 },
      })),
      update: vi.fn(async ({ where }: { where: { id: number } }) => ({
        id: where.id,
        sequence: 2,
        due_date: parseCalendarDate('2026-03-05'),
        amount: 500,
        status: 'PAID',
        paid_at: new Date(),
      })),
      count: vi.fn(async () => 3),
    },
    creditCardInstallmentPlan: { update: vi.fn() },
  });

  type Tx = Parameters<typeof coverInstallmentPlanPaymentForCardPayment>[0];

  let tx: ReturnType<typeof makeTx>;

  beforeEach(() => {
    tx = makeTx([{ id: 21, amount: 500 }]);
  });

  it('leaves the cuota scheduled when a partial payment falls in the window', async () => {
    const result = await coverInstallmentPlanPaymentForCardPayment(
      tx as unknown as Tx,
      7,
      ownerFilter,
      '2026-03-03',
      200,
      12,
    );

    expect(result).toBeNull();
    expect(tx.creditCardInstallmentPlanPayment.update).not.toHaveBeenCalled();
  });

  it('marks the cuota paid on the given transaction when the payment covers it', async () => {
    const result = await coverInstallmentPlanPaymentForCardPayment(
      tx as unknown as Tx,
      7,
      ownerFilter,
      '2026-03-03',
      800,
      12,
    );

    expect(result?.id).toBe(21);
    expect(tx.creditCardInstallmentPlanPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          due_date: cardPaymentMatchWindow('2026-03-03'),
        }),
      }),
    );
    expect(tx.creditCardInstallmentPlanPayment.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: expect.objectContaining({ status: 'PAID', credit_card_payment_id: 12 }),
    });
    expect(tx.creditCardInstallmentPlan.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { paid_installments: 3 },
    });
  });
});

describe('coverScheduledPaymentForCardPayment', () => {
  it('does not mark a larger scheduled payment as paid', async () => {
    const tx = {
      creditCardScheduledPayment: {
        findMany: vi.fn(async () => [{ id: 31, amount: 3000 }]),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const result = await coverScheduledPaymentForCardPayment(
      tx as unknown as Parameters<typeof coverScheduledPaymentForCardPayment>[0],
      7,
      ownerFilter,
      '2026-03-03',
      1000,
      12,
    );

    expect(result).toBeNull();
    expect(tx.creditCardScheduledPayment.update).not.toHaveBeenCalled();
  });
});
