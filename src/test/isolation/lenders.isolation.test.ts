import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  RESOURCE_ID,
  contextUserB,
  forbiddenHouseContext,
  requestFor,
  paramsOf,
} from '@/test/isolation/helpers';

const {
  getOwnerContext,
  getLenderByIdForOwner,
  payLenderForOwner,
  undoLenderPaymentForOwner,
  listLendersByOwner,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  getLenderByIdForOwner: vi.fn(),
  payLenderForOwner: vi.fn(),
  undoLenderPaymentForOwner: vi.fn(),
  listLendersByOwner: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/finance/lender.service', () => ({
  getLenderByIdForOwner,
  payLenderForOwner,
  undoLenderPaymentForOwner,
  listLendersByOwner,
  createLenderForOwner: vi.fn(),
}));

import { GET as getLender } from '@/app/api/lenders/[id]/route';
import { POST as payLender } from '@/app/api/lenders/[id]/pay/route';
import { DELETE as undoPayment } from '@/app/api/lenders/[id]/payments/[paymentId]/route';
import { GET as listLenders } from '@/app/api/lenders/route';

describe('isolation: lenders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    getLenderByIdForOwner.mockRejectedValue(new Error('Prestamista no encontrado'));
    payLenderForOwner.mockRejectedValue(new Error('Prestamista no encontrado'));
    undoLenderPaymentForOwner.mockRejectedValue(
      new Error('Pago del prestamista no encontrado'),
    );
    listLendersByOwner.mockResolvedValue([]);
  });

  it('GET /api/lenders/[id] → 404 for another owner', async () => {
    const response = await getLender(
      requestFor(`/api/lenders/${RESOURCE_ID}`) as Parameters<typeof getLender>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('SECRET');
  });

  it('POST /api/lenders/[id]/pay → 404 for another owner', async () => {
    const response = await payLender(
      requestFor(`/api/lenders/${RESOURCE_ID}/pay`, {
        method: 'POST',
        body: { mode: 'EXTERNAL', paidAt: '2026-09-10' },
      }) as Parameters<typeof payLender>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });

  it('DELETE /api/lenders/[id]/payments/[paymentId] → 404 for another owner', async () => {
    const response = await undoPayment(
      requestFor(`/api/lenders/${RESOURCE_ID}/payments/${RESOURCE_ID}`, {
        method: 'DELETE',
      }) as Parameters<typeof undoPayment>[0],
      {
        params: Promise.resolve({
          id: String(RESOURCE_ID),
          paymentId: String(RESOURCE_ID),
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it('GET /api/lenders → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await listLenders(
      requestFor('/api/lenders', {
        ownerType: 'house',
        ownerId: HOUSE_A,
      }) as Parameters<typeof listLenders>[0],
    );

    expect(response.status).toBe(403);
  });
});
