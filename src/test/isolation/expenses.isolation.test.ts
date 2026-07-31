import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  RESOURCE_ID,
  USER_A,
  assertIsolationDenied,
  contextUserB,
  forbiddenHouseContext,
  ownerScopedFindFirst,
  paramsOf,
  requestFor,
} from '@/test/isolation/helpers';

const {
  getOwnerContext,
  findFirstExpense,
  toggleExpensePaid,
  updateExpense,
  deleteExpense,
  $transaction,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFirstExpense: vi.fn(),
  toggleExpensePaid: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expense: { findFirst: findFirstExpense },
    creditCardPayment: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction,
  },
}));

vi.mock('@/lib/finance/expense.service', () => ({
  toggleExpensePaid,
  updateExpense,
  deleteExpense,
  createExpense: vi.fn(),
}));

vi.mock('@/lib/observability/finance-log', () => ({
  logFinanceEvent: vi.fn(),
}));

import { PATCH as patchPaid } from '@/app/api/expenses/[id]/paid/route';
import { PUT, DELETE } from '@/app/api/transactions/route';

const foreignExpense = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  description: 'SECRET_EXPENSE_A',
  amount: 999,
  wallet_id: 1,
  is_paid: false,
};

describe('isolation: expenses / transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    findFirstExpense.mockImplementation(ownerScopedFindFirst(foreignExpense));
  });

  it('PATCH /api/expenses/[id]/paid → 404 for User A expense under User B context', async () => {
    const response = await patchPaid(
      requestFor(`/api/expenses/${RESOURCE_ID}/paid`, {
        method: 'PATCH',
        body: { paid: true },
      }) as Parameters<typeof patchPaid>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_EXPENSE_A');
    expect(toggleExpensePaid).not.toHaveBeenCalled();
  });

  it('PATCH paid → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await patchPaid(
      requestFor(`/api/expenses/${RESOURCE_ID}/paid`, {
        method: 'PATCH',
        ownerType: 'house',
        ownerId: HOUSE_A,
        body: { paid: true },
      }) as Parameters<typeof patchPaid>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });

  it('PUT /api/transactions → 404 for User A expense under User B context', async () => {
    const response = await PUT(
      requestFor('/api/transactions', {
        method: 'PUT',
        searchParams: { id: String(RESOURCE_ID) },
        body: {
          description: 'hack',
          amount: 1,
          category_id: 1,
          fortnight_id: 1,
          is_paid: false,
        },
      }) as Parameters<typeof PUT>[0],
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_EXPENSE_A');
    expect(updateExpense).not.toHaveBeenCalled();
  });

  it('DELETE /api/transactions → 404 for User A expense under User B context', async () => {
    const response = await DELETE(
      requestFor('/api/transactions', {
        method: 'DELETE',
        searchParams: { id: String(RESOURCE_ID) },
      }) as Parameters<typeof DELETE>[0],
    );

    expect(response.status).toBe(404);
    expect(deleteExpense).not.toHaveBeenCalled();
  });
});
