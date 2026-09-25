import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import {
  createBudget,
  deleteBudget,
  updateBudgetAllocations,
  updateBudgetTemplate,
} from './budget.service';

const mocks = vi.hoisted(() => ({
  budget: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  budgetAllocation: {
    createMany: vi.fn(),
  },
  fortnight: {
    findFirst: vi.fn(),
  },
  category: {
    findMany: vi.fn(),
  },
  transaction: vi.fn(),
  generatePeriodsOnCreate: vi.fn(),
  syncBudgetPeriodsAfterTemplateUpdate: vi.fn(),
  deleteFuturePeriods: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budget: mocks.budget,
    budgetAllocation: mocks.budgetAllocation,
    fortnight: mocks.fortnight,
    category: mocks.category,
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/finance/budget-period.service', () => ({
  generatePeriodsOnCreate: mocks.generatePeriodsOnCreate,
  syncBudgetPeriodsAfterTemplateUpdate: mocks.syncBudgetPeriodsAfterTemplateUpdate,
  deleteFuturePeriods: mocks.deleteFuturePeriods,
  refreshFuturePeriodSnapshots: vi.fn(),
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

  it('soft-deactivates the budget and cancels future periods', async () => {
    mocks.budget.findFirst.mockResolvedValue(budgetFixture);
    mocks.budget.update.mockResolvedValue({ ...budgetFixture, active: false });
    mocks.deleteFuturePeriods.mockResolvedValue(2);

    await deleteBudget(10, ownerFilter);

    expect(mocks.budget.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { active: false },
    });
    expect(mocks.deleteFuturePeriods).toHaveBeenCalledWith(10);
    expect(mocks.budget.delete).not.toHaveBeenCalled();
  });

  it('throws when the budget is not found', async () => {
    mocks.budget.findFirst.mockResolvedValue(null);

    await expect(deleteBudget(10, ownerFilter)).rejects.toMatchObject({
      code: 'P2025',
    });
    expect(mocks.budget.update).not.toHaveBeenCalled();
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
    mocks.generatePeriodsOnCreate.mockResolvedValue(1);
  });

  it('uses canonical calendar fortnight bounds for BIWEEKLY budgets', async () => {
    const currentFortnight = {
      start_date: new Date('2026-06-01T00:00:00.000Z'), // legacy off-by-one encoding
      end_date: new Date('2026-06-14T00:00:00.000Z'),
      year: 2026,
      month: 6,
      period: 'FIRST' as const,
    };
    const expectedBounds = {
      start_date: parseCalendarDate('2026-05-31'),
      end_date: parseCalendarDate('2026-06-14'),
    };
    mocks.fortnight.findFirst.mockResolvedValue(currentFortnight);
    mocks.budget.create.mockResolvedValue({ ...budgetFixture, id: 11 });

    await createBudget('user', 1, {
      name: 'Despensa',
      allocated_amount: 500,
      frequency: 'BIWEEKLY',
      recurrent: true,
      allocations: [{ wallet_id: 1, category_id: 2, amount: 500 }],
    });

    expect(mocks.budget.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        start_date: expectedBounds.start_date,
        end_date: expectedBounds.end_date,
      }),
    });

    expect(mocks.generatePeriodsOnCreate).toHaveBeenCalledWith(
      11,
      'BIWEEKLY',
      expectedBounds,
      ownerFilter,
      { recurrent: true },
    );
  });

  it('passes a single-day range for DAILY budgets', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T18:00:00.000Z'));

    mocks.budget.create.mockResolvedValue({ ...budgetFixture, id: 12, frequency: 'DAILY' });

    await createBudget('user', 1, {
      name: 'Café',
      allocated_amount: 100,
      frequency: 'DAILY',
      recurrent: true,
      allocations: [{ wallet_id: 1, category_id: 2, amount: 100 }],
    });

    expect(mocks.generatePeriodsOnCreate).toHaveBeenCalledWith(
      12,
      'DAILY',
      {
        start_date: parseCalendarDate('2026-06-04'),
        end_date: parseCalendarDate('2026-06-04'),
      },
      ownerFilter,
      { recurrent: true },
    );

    vi.useRealTimers();
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

  it('rejects an allocation with a zero amount', async () => {
    await expect(
      createBudget('user', 1, {
        name: 'Transporte',
        allocated_amount: 500,
        frequency: 'BIWEEKLY',
        recurrent: true,
        allocations: [
          { wallet_id: 1, category_id: 2, amount: 500 },
          { wallet_id: 2, category_id: 3, amount: 0 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'EMPTY_ALLOCATION' });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('stores a null wallet for Cualquier cartera and keeps a specific wallet id', async () => {
    mocks.fortnight.findFirst.mockResolvedValue({
      start_date: parseCalendarDate('2026-06-01'),
      end_date: parseCalendarDate('2026-06-14'),
      year: 2026,
      month: 6,
      period: 'FIRST' as const,
    });
    mocks.category.findMany.mockResolvedValue([
      { id: 2, parent_id: null },
      { id: 3, parent_id: null },
    ]);
    mocks.budget.create.mockResolvedValue({ ...budgetFixture, id: 13 });

    await createBudget('user', 1, {
      name: 'Despensa',
      allocated_amount: 500,
      frequency: 'BIWEEKLY',
      recurrent: true,
      allocations: [
        { wallet_id: null, category_id: 2, amount: 300 },
        { wallet_id: 1, category_id: 3, amount: 200 },
      ],
    });

    expect(mocks.budgetAllocation.createMany).toHaveBeenCalledWith({
      data: [
        { budget_id: 13, wallet_id: null, category_id: 2, amount: 300 },
        { budget_id: 13, wallet_id: 1, category_id: 3, amount: 200 },
      ],
    });
  });

  it('rejects overlapping Cualquier cartera allocations', async () => {
    mocks.category.findMany.mockResolvedValue([
      { id: 10, parent_id: null },
      { id: 11, parent_id: 10 },
    ]);

    await expect(
      createBudget('user', 1, {
        name: 'Comida',
        allocated_amount: 500,
        frequency: 'BIWEEKLY',
        recurrent: true,
        allocations: [
          { wallet_id: null, category_id: 10, amount: 300 },
          { wallet_id: 1, category_id: 11, amount: 200 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'ALLOCATION_OVERLAP' });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe('budget updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects zero-amount allocations when updating allocations', async () => {
    mocks.budget.findFirst.mockResolvedValue(budgetFixture);

    await expect(
      updateBudgetAllocations(10, ownerFilter, [
        { wallet_id: 1, category_id: 2, amount: 500 },
        { wallet_id: 2, category_id: 3, amount: 0 },
      ]),
    ).rejects.toMatchObject({ code: 'EMPTY_ALLOCATION' });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects a template update when an existing allocation has a zero amount', async () => {
    mocks.budget.findFirst.mockResolvedValue({
      ...budgetFixture,
      allocations: [
        { wallet_id: 1, category_id: 2, amount: 500 },
        { wallet_id: 2, category_id: 3, amount: 0 },
      ],
    });

    await expect(
      updateBudgetTemplate(10, ownerFilter, {
        name: 'Despensa actualizada',
        allocated_amount: 500,
        frequency: 'BIWEEKLY',
        recurrent: true,
        start_date: null,
        end_date: null,
      }),
    ).rejects.toMatchObject({ code: 'EMPTY_ALLOCATION' });

    expect(mocks.budget.update).not.toHaveBeenCalled();
  });
});
