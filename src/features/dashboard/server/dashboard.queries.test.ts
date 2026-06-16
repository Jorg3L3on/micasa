import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyExpense } = vi.hoisted(() => ({
  findManyExpense: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expense: { findMany: findManyExpense },
  },
}));

import { fetchRecentExpenses } from './dashboard.queries';

describe('fetchRecentExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyExpense.mockResolvedValue([]);
  });

  it('excludes loan-payment generated expenses from recent activity gastos', async () => {
    await fetchRecentExpenses({ user_id: 1, house_id: null });

    expect(findManyExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id: 1,
          house_id: null,
          loan_payment_id: null,
        },
      }),
    );
  });
});
