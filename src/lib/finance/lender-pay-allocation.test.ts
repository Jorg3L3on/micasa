import { describe, expect, it } from 'vitest';
import {
  allocateLenderPayment,
  parseStoredLenderAllocation,
  type LenderPaySlice,
} from '@/lib/finance/lender-pay-allocation';

const slice = (
  overrides: Partial<LenderPaySlice> & Pick<LenderPaySlice, 'id' | 'amount'>,
): LenderPaySlice => ({
  loanId: 1,
  dueDate: '2026-09-05',
  sequence: 1,
  ...overrides,
});

describe('allocateLenderPayment', () => {
  it('pays the window exactly when amount is omitted', () => {
    const plan = allocateLenderPayment(
      [
        slice({ id: 1, loanId: 10, amount: 100, dueDate: '2026-09-05' }),
        slice({ id: 2, loanId: 11, amount: 80, dueDate: '2026-09-18' }),
      ],
      [],
      null,
    );

    expect(plan.amount).toBe(180);
    expect(plan.fullPaymentIds).toEqual([1, 2]);
    expect(plan.splits).toEqual([]);
    expect(plan.reductions).toEqual([]);
  });

  it('splits the first installment that the partial does not cover', () => {
    const plan = allocateLenderPayment(
      [
        slice({ id: 1, loanId: 10, amount: 100 }),
        slice({ id: 2, loanId: 11, amount: 80, dueDate: '2026-09-18' }),
      ],
      [],
      40,
    );

    expect(plan.fullPaymentIds).toEqual([]);
    expect(plan.splits).toEqual([
      {
        paymentId: 1,
        loanId: 10,
        previousAmount: 100,
        paidAmount: 40,
        remainderAmount: 60,
      },
    ]);
  });

  it('applies extra principal from the latest future installment', () => {
    const plan = allocateLenderPayment(
      [slice({ id: 1, loanId: 10, amount: 100, dueDate: '2026-09-05' })],
      [
        slice({
          id: 3,
          loanId: 10,
          amount: 100,
          dueDate: '2026-11-05',
          sequence: 3,
        }),
        slice({
          id: 2,
          loanId: 10,
          amount: 100,
          dueDate: '2026-10-05',
          sequence: 2,
        }),
      ],
      150,
    );

    expect(plan.fullPaymentIds).toEqual([1]);
    expect(plan.reductions).toEqual([
      {
        paymentId: 3,
        loanId: 10,
        previousAmount: 100,
        nextAmount: 50,
      },
    ]);
  });

  it('rejects extra that exceeds remaining principal', () => {
    expect(() =>
      allocateLenderPayment(
        [slice({ id: 1, amount: 100 })],
        [slice({ id: 2, amount: 20, dueDate: '2026-10-05', sequence: 2 })],
        200,
      ),
    ).toThrow('capital pendiente');
  });
});

describe('parseStoredLenderAllocation', () => {
  it('reads a stored split and reduction', () => {
    expect(
      parseStoredLenderAllocation({
        fullPaymentIds: [1],
        splits: [
          {
            sourcePaymentId: 2,
            paidPaymentId: 9,
            loanId: 4,
            previousAmount: 100,
          },
        ],
        reductions: [
          {
            paymentId: 3,
            loanId: 4,
            previousAmount: 80,
            cancelled: true,
          },
        ],
      }),
    ).toEqual({
      fullPaymentIds: [1],
      splits: [
        {
          sourcePaymentId: 2,
          paidPaymentId: 9,
          loanId: 4,
          previousAmount: 100,
        },
      ],
      reductions: [
        {
          paymentId: 3,
          loanId: 4,
          previousAmount: 80,
          cancelled: true,
        },
      ],
    });
  });

  it('returns null for legacy payments', () => {
    expect(parseStoredLenderAllocation(null)).toBeNull();
  });
});
