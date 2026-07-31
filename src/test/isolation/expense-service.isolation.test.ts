import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RESOURCE_ID,
  USER_A,
  USER_B,
  ownerFilterB,
  ownerScopedFindFirst,
} from '@/test/isolation/helpers';

const { findFirstExpense, $transaction } = vi.hoisted(() => ({
  findFirstExpense: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expense: { findFirst: findFirstExpense },
    category: { findFirst: vi.fn() },
    $transaction,
  },
}));

import {
  deleteExpense,
  toggleExpensePaid,
  updateExpense,
} from '@/lib/finance/expense.service';

const foreignExpense = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  description: 'SECRET_EXPENSE_A',
  amount: 50,
  is_paid: false,
  wallet_id: null,
  wallet: null,
  fortnight: { id: 1, user_id: USER_A, house_id: null },
  loan_payment: null,
  category: { name: 'Food', icon: null },
  transferAsUser: null,
};

describe('isolation: expense.service ownerFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstExpense.mockImplementation(ownerScopedFindFirst(foreignExpense));
    $transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        expense: { findFirst: findFirstExpense, update: vi.fn(), delete: vi.fn() },
        transfer: { findFirst: vi.fn().mockResolvedValue(null) },
        creditCardPayment: { findFirst: vi.fn().mockResolvedValue(null) },
        wallet: { findFirst: vi.fn(), findUnique: vi.fn() },
        fortnight: { findFirst: vi.fn() },
      };
      return fn(tx);
    });
  });

  it('updateExpense rejects cross-tenant id with User B ownerFilter', async () => {
    await expect(
      updateExpense({
        id: RESOURCE_ID,
        ownerFilter: ownerFilterB,
        description: 'hack',
      }),
    ).rejects.toMatchObject({ code: 'P2025' });

    expect(findFirstExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: RESOURCE_ID,
          user_id: USER_B,
          house_id: null,
        }),
      }),
    );
  });

  it('toggleExpensePaid rejects cross-tenant id with User B ownerFilter', async () => {
    await expect(
      toggleExpensePaid({
        id: RESOURCE_ID,
        paid: true,
        ownerFilter: ownerFilterB,
      }),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('deleteExpense rejects cross-tenant id with User B ownerFilter', async () => {
    await expect(
      deleteExpense({
        id: RESOURCE_ID,
        ownerFilter: ownerFilterB,
      }),
    ).rejects.toMatchObject({ code: 'P2025' });
  });
});
