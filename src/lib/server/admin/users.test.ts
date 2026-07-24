import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  findManyExpense,
  findManyIncome,
  findManyCardPayment,
  findManyTransfer,
  findManyLoanPayment,
  findManyUser,
  findUniqueUser,
} = vi.hoisted(() => ({
  findManyExpense: vi.fn(),
  findManyIncome: vi.fn(),
  findManyCardPayment: vi.fn(),
  findManyTransfer: vi.fn(),
  findManyLoanPayment: vi.fn(),
  findManyUser: vi.fn(),
  findUniqueUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findMany: findManyUser,
      findUnique: findUniqueUser,
    },
    expense: { findMany: findManyExpense },
    income: { findMany: findManyIncome },
    creditCardPayment: { findMany: findManyCardPayment },
    transfer: { findMany: findManyTransfer },
    loanPayment: { findMany: findManyLoanPayment },
  },
}));

import {
  buildAdminRecentActivity,
  searchAdminUsers,
} from './users';

describe('searchAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps user rows for list', async () => {
    findManyUser.mockResolvedValue([
      {
        id: 1,
        name: 'Ana',
        email: 'ana@test.com',
        active: true,
        onboarding_completed: true,
        is_admin: false,
        created_at: new Date('2026-01-01T12:00:00.000Z'),
      },
    ]);

    const rows = await searchAdminUsers({ q: 'ana' });
    expect(findManyUser).toHaveBeenCalled();
    expect(rows).toEqual([
      {
        id: 1,
        name: 'Ana',
        email: 'ana@test.com',
        active: true,
        onboarding_completed: true,
        is_admin: false,
        created_at: '2026-01-01T12:00:00.000Z',
      },
    ]);
  });
});

describe('buildAdminRecentActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyExpense.mockResolvedValue([]);
    findManyIncome.mockResolvedValue([]);
    findManyCardPayment.mockResolvedValue([]);
    findManyTransfer.mockResolvedValue([]);
    findManyLoanPayment.mockResolvedValue([]);
  });

  it('returns empty list when no domain rows', async () => {
    await expect(buildAdminRecentActivity(7)).resolves.toEqual([]);
  });

  it('merges and sorts events newest-first capped at limit', async () => {
    findManyExpense.mockResolvedValue([
      {
        id: 1,
        description: 'Super',
        amount: 100,
        is_paid: true,
        created_at: new Date('2026-01-01T10:00:00.000Z'),
      },
    ]);
    findManyIncome.mockResolvedValue([
      {
        id: 2,
        source: 'Nómina',
        amount: 5000,
        created_at: new Date('2026-01-02T10:00:00.000Z'),
        received_at: new Date('2026-01-02T10:00:00.000Z'),
      },
    ]);
    findManyTransfer.mockResolvedValue([
      {
        id: 3,
        amount: 200,
        note: null,
        type: 'USER_TO_HOUSE',
        created_at: new Date('2026-01-01T12:00:00.000Z'),
        house: { name: 'Casa' },
      },
    ]);

    const events = await buildAdminRecentActivity(7, 50);
    expect(events.map((e) => e.id)).toEqual([
      'income:2',
      'transfer:3',
      'expense:1',
    ]);
    expect(events[0]).toMatchObject({
      type: 'income',
      label: 'Ingreso',
      amount: 5000,
      summary: 'Nómina',
    });
  });
});
