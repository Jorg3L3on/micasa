import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/finance/domain-error';

const mocks = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  setBudgetFortnightAdjustment: vi.fn(),
  clearBudgetFortnightAdjustment: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext: mocks.getOwnerContext }));
vi.mock('@/lib/finance/budget-adjustment.service', () => ({
  setBudgetFortnightAdjustment: mocks.setBudgetFortnightAdjustment,
  clearBudgetFortnightAdjustment: mocks.clearBudgetFortnightAdjustment,
}));

import { DELETE, PUT } from './route';

const ownerFilter = { user_id: 1, house_id: null };
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const put = (id: string, body: unknown) => {
  const url = new URL(`http://test/api/budgets/${id}/adjustments`);
  const req = new Request(url, { method: 'PUT', body: JSON.stringify(body) });
  return PUT(Object.assign(req, { nextUrl: url }) as never, params(id));
};
const del = (id: string, query: string) => {
  const url = new URL(`http://test/api/budgets/${id}/adjustments?${query}`);
  return DELETE(Object.assign(new Request(url, { method: 'DELETE' }), { nextUrl: url }) as never, params(id));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOwnerContext.mockResolvedValue({ userId: 1, ownerType: 'user', ownerId: 1, ownerFilter, role: 'owner' });
});

describe('PUT /api/budgets/[id]/adjustments', () => {
  it('saves a pause scoped to the owner', async () => {
    mocks.setBudgetFortnightAdjustment.mockResolvedValue({ id: 1 });
    const res = await put('10', { year: 2026, month: 11, period: 'FIRST', kind: 'PAUSE' });
    expect(res.status).toBe(200);
    expect(mocks.setBudgetFortnightAdjustment).toHaveBeenCalledWith(10, ownerFilter, {
      year: 2026,
      month: 11,
      period: 'FIRST',
      kind: 'PAUSE',
    });
  });

  it('400 on a negative amount, a missing amount or a bad id', async () => {
    expect((await put('10', { year: 2026, month: 11, period: 'FIRST', kind: 'AMOUNTS', total: -5 })).status).toBe(400);
    expect((await put('10', { year: 2026, month: 11, period: 'FIRST', kind: 'AMOUNTS' })).status).toBe(400);
    expect((await put('abc', { year: 2026, month: 11, period: 'FIRST', kind: 'PAUSE' })).status).toBe(400);
    expect(mocks.setBudgetFortnightAdjustment).not.toHaveBeenCalled();
  });

  it('422 for a closed quincena, one too far, or an inactive budget; 404 for another owner', async () => {
    for (const [code, status] of [
      ['ADJUSTMENT_CLOSED_QUINCENA', 422],
      ['ADJUSTMENT_QUINCENA_TOO_FAR', 422],
      ['BUDGET_INACTIVE', 422],
      ['P2025', 404],
    ] as const) {
      mocks.setBudgetFortnightAdjustment.mockRejectedValueOnce(
        new DomainError(code, 'msg', code === 'P2025' ? undefined : 422),
      );
      const res = await put('10', { year: 2026, month: 11, period: 'FIRST', kind: 'PAUSE' });
      expect(res.status, code).toBe(status);
      expect((await res.json()).code).toBe(code);
    }
  });
});

describe('DELETE /api/budgets/[id]/adjustments', () => {
  it('clears one quincena', async () => {
    mocks.clearBudgetFortnightAdjustment.mockResolvedValue(1);
    const res = await del('10', 'year=2026&month=11&period=SECOND');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 1 });
    expect(mocks.clearBudgetFortnightAdjustment).toHaveBeenCalledWith(10, ownerFilter, {
      year: 2026,
      month: 11,
      period: 'SECOND',
    });
  });

  it('400 without the quincena', async () => {
    expect((await del('10', 'year=2026')).status).toBe(400);
  });
});
