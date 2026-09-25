import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getOwnerContext,
  categoryFindFirst,
  walletFindFirst,
  createExpense,
  resolveOrCreateFortnight,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  categoryFindFirst: vi.fn(),
  walletFindFirst: vi.fn(),
  createExpense: vi.fn(),
  resolveOrCreateFortnight: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    category: { findFirst: categoryFindFirst },
    wallet: { findFirst: walletFindFirst },
  },
}));

vi.mock('@/lib/finance/expense.service', () => ({
  createExpense,
}));

vi.mock('@/lib/fortnights', () => ({
  resolveOrCreateFortnight,
}));

import { POST } from './route';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

const postExpense = (body: unknown) =>
  POST(
    new Request('http://localhost/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0],
  );

const expenseBody = {
  name: 'Super',
  categoryId: 2,
  amount: 640,
  date: '2026-09-15',
  isPaid: false,
  isRecurring: false,
  applyToBothFortnights: false,
};

describe('POST /api/expenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
    categoryFindFirst.mockResolvedValue({ id: 2, kind: 'EXPENSE' });
    walletFindFirst.mockResolvedValue({ id: 4 });
    resolveOrCreateFortnight.mockResolvedValue({ id: 20 });
    createExpense.mockResolvedValue({
      id: 90,
      description: 'Super',
      amount: 640,
      payment_date: new Date('2026-09-15T06:00:00.000Z'),
      category: 'Comida',
      categoryIcon: null,
      paymentMethod: 'Efectivo',
    });
  });

  it('rejects an expense without a wallet', async () => {
    const response = await postExpense({
      ...expenseBody,
      paymentMethodId: null,
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).toContain('billetera');
    expect(createExpense).not.toHaveBeenCalled();
  });

  it('persists the chosen Mexico City civil day for a planned expense', async () => {
    const response = await postExpense({
      ...expenseBody,
      paymentMethodId: 4,
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentDate: '2026-09-15',
        isPaid: false,
        walletId: 4,
        fortnightId: 20,
      }),
    );
    expect(body.date).toBe('2026-09-15');
    expect(body.walletId).toBe(4);
  });

  it('keeps the calendar day across midnight and month edges', async () => {
    for (const date of ['2026-01-01', '2026-03-01', '2026-12-31']) {
      createExpense.mockResolvedValueOnce({
        id: 91,
        description: 'Super',
        amount: 640,
        payment_date: new Date(`${date}T06:00:00.000Z`),
        category: 'Comida',
        categoryIcon: null,
        paymentMethod: 'Débito',
      });

      const response = await postExpense({
        ...expenseBody,
        paymentMethodId: 4,
        date,
        isPaid: true,
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.date).toBe(date);
      expect(createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ paymentDate: date, walletId: 4 }),
      );
    }
  });
});
