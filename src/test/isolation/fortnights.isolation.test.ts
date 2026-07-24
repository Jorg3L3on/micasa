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

const { getOwnerContext, findFirstFortnight } = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFirstFortnight: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    fortnight: { findFirst: findFirstFortnight },
  },
}));

import { PUT as overrideAmount } from '@/app/api/fortnights/[id]/override-amount/route';
import { POST as regenerate } from '@/app/api/fortnights/[id]/regenerate-from-templates/route';

const foreignFortnight = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  year: 2026,
  month: 7,
  period: 'FIRST',
  secret_label: 'SECRET_FORTNIGHT_A',
};

describe('isolation: fortnights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    findFirstFortnight.mockImplementation(
      ownerScopedFindFirst(foreignFortnight),
    );
  });

  it('PUT override-amount → 404 for User A fortnight under User B context', async () => {
    const response = await overrideAmount(
      requestFor(`/api/fortnights/${RESOURCE_ID}/override-amount`, {
        method: 'PUT',
        body: { year: 2026, month: 7, amount: 100 },
      }) as Parameters<typeof overrideAmount>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_FORTNIGHT_A');
  });

  it('PUT override-amount → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await overrideAmount(
      requestFor(`/api/fortnights/${RESOURCE_ID}/override-amount`, {
        method: 'PUT',
        ownerType: 'house',
        ownerId: HOUSE_A,
        body: { year: 2026, month: 7, amount: 100 },
      }) as Parameters<typeof overrideAmount>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });

  it('POST regenerate-from-templates → 404 for User A fortnight', async () => {
    const response = await regenerate(
      requestFor(`/api/fortnights/${RESOURCE_ID}/regenerate-from-templates`, {
        method: 'POST',
      }) as Parameters<typeof regenerate>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });
});
