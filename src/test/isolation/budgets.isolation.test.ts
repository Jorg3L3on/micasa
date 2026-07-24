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

const { getOwnerContext, findFirstBudget } = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFirstBudget: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    budget: { findFirst: findFirstBudget },
  },
}));

import { PATCH, DELETE } from '@/app/api/budgets/[id]/route';
import { PATCH as patchActive } from '@/app/api/budgets/[id]/active/route';

const foreignBudget = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  name: 'SECRET_BUDGET_A',
  allocations: [],
  allocated_amount: 1000,
};

describe('isolation: budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    findFirstBudget.mockImplementation(ownerScopedFindFirst(foreignBudget));
  });

  it('PATCH /api/budgets/[id] → 404 for User A budget under User B context', async () => {
    const response = await PATCH(
      requestFor(`/api/budgets/${RESOURCE_ID}`, {
        method: 'PATCH',
        body: {
          name: 'hack',
          allocated_amount: 100,
          frequency: 'WEEKLY',
          recurrent: true,
        },
      }) as Parameters<typeof PATCH>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_BUDGET_A');
  });

  it('DELETE /api/budgets/[id] → 404 for User A budget', async () => {
    const response = await DELETE(
      requestFor(`/api/budgets/${RESOURCE_ID}`, {
        method: 'DELETE',
      }) as Parameters<typeof DELETE>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });

  it('PATCH /api/budgets/[id]/active → 404 for User A budget', async () => {
    const response = await patchActive(
      requestFor(`/api/budgets/${RESOURCE_ID}/active`, {
        method: 'PATCH',
        body: { active: false },
      }) as Parameters<typeof patchActive>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });

  it('PATCH /api/budgets/[id] → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await PATCH(
      requestFor(`/api/budgets/${RESOURCE_ID}`, {
        method: 'PATCH',
        ownerType: 'house',
        ownerId: HOUSE_A,
        body: {
          name: 'hack',
          allocated_amount: 100,
          frequency: 'WEEKLY',
          recurrent: true,
        },
      }) as Parameters<typeof PATCH>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });
});
