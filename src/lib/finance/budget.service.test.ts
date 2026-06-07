import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBudget, deleteBudget } from './budget.service';

const mocks = vi.hoisted(() => ({
  budget: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  budgetAllocation: {
    createMany: vi.fn(),
  },
  fortnight: {
    findFirst: vi.fn(),
  },
  transaction: vi.fn(),
  generatePeriodsOnCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budget: mocks.budget,
    budgetAllocation: mocks.budgetAllocation,
    fortnight: mocks.fortnight,
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/finance/budget-period.service', () => ({
  generatePeriodsOnCreate: mocks.generatePeriodsOnCreate,
}));

const ownerFilter = { user_id: 1, house_id: null };

const budgetFixture = {
  id: 10,
  name: 'Despensa',
  total_amount: 500,
  frequency: 'BIWEEKLY',
  recurrent: true,
  start_date: null,
  end_date: null,
  active: true,
};

describe('deleteBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hard-deletes the budget when it exists', async () => {
    mocks.budget.findFirst.mockResolvedValue(budgetFixture);
    mocks.budget.delete.mockResolvedValue(budgetFixture);

    await deleteBudget(10, ownerFilter);

    expect(mocks.budget.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('throws when the budget is not found', async () => {
    mocks.budget.findFirst.mockResolvedValue(null);

    await expect(deleteBudget(10, ownerFilter)).rejects.toMatchObject({
      code: 'P2025',
    });
    expect(mocks.budget.delete).not.toHaveBeenCalled();
  });
});

describe('createBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) =>
      callback({
        budget: mocks.budget,
        budgetAllocation: mocks.budgetAllocation,
      }),
    );
    mocks.generatePeriodsOnCreate.mockResolvedValue(undefined);
  });

  it('uses the current fortnight dates for BIWEEKLY budgets', async () => {
    const currentFortnight = {
      start_date: new Date('2026-06-01T12:00:00.000Z'),
      end_date: new Date('2026-06-15T12:00:00.000Z'),
    };
    mocks.fortnight.findFirst.mockResolvedValue(currentFortnight);
    mocks.budget.create.mockResolvedValue({ id: 11, ...budgetFixture });

    await createBudget('user', 1, {
      name: 'Despensa',
      allocated_amount: 500,
      frequency: 'BIWEEKLY',
      recurrent: true,
      allocations: [{ wallet_id: 1, category_id: 2, amount: 500 }],
    });

    expect(mocks.budget.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        start_date: currentFortnight.start_date,
        end_date: currentFortnight.end_date,
      }),
    });
  });

  it('throws when the current fortnight is missing for BIWEEKLY budgets', async () => {
    mocks.fortnight.findFirst.mockResolvedValue(null);

    await expect(
      createBudget('user', 1, {
        name: 'Despensa',
        allocated_amount: 500,
        frequency: 'BIWEEKLY',
        recurrent: true,
        allocations: [{ wallet_id: 1, category_id: 2, amount: 500 }],
      }),
    ).rejects.toMatchObject({ code: 'CURRENT_FORTNIGHT_NOT_FOUND' });
  });
});
