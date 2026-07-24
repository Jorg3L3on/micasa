import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  RESOURCE_ID,
  USER_A,
  USER_B,
  contextUserB,
  forbiddenHouseContext,
  ownerFilterB,
  ownerScopedFindFirst,
  paramsOf,
  requestFor,
} from '@/test/isolation/helpers';

const {
  getOwnerContext,
  findFirstLoan,
  updateLoanPaymentForOwner,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFirstLoan: vi.fn(),
  updateLoanPaymentForOwner: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    loan: { findFirst: findFirstLoan },
    $transaction: async (fn: (tx: {
      loan: { findFirst: typeof findFirstLoan; delete: ReturnType<typeof vi.fn> };
    }) => unknown) =>
      fn({
        loan: {
          findFirst: findFirstLoan,
          delete: vi.fn(),
        },
      }),
  },
}));

vi.mock('@/lib/finance/loan.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/loan.service')>();
  return {
    ...actual,
    updateLoanPaymentForOwner,
  };
});

import { PATCH, DELETE } from '@/app/api/loans/[id]/route';
import { PATCH as patchPayment } from '@/app/api/loans/payments/[id]/route';

const foreignLoan = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  status: 'ACTIVE',
  payment_source: 'MANUAL',
  name: 'SECRET_LOAN_A',
};

describe('isolation: loans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    findFirstLoan.mockImplementation(ownerScopedFindFirst(foreignLoan));
    updateLoanPaymentForOwner.mockImplementation(
      async (_id: number, filter: { user_id: number | null }) => {
        if (filter.user_id === USER_B) {
          throw new Error('Pago de préstamo no encontrado');
        }
        return { id: RESOURCE_ID, name: 'SECRET_PAYMENT_A' };
      },
    );
  });

  it('PATCH /api/loans/[id] → 404 for User A loan under User B context', async () => {
    const response = await PATCH(
      requestFor(`/api/loans/${RESOURCE_ID}`, {
        method: 'PATCH',
        body: { name: 'hack' },
      }) as Parameters<typeof PATCH>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('SECRET_LOAN_A');
  });

  it('DELETE /api/loans/[id] → 404 for User A loan', async () => {
    const response = await DELETE(
      requestFor(`/api/loans/${RESOURCE_ID}`, {
        method: 'DELETE',
      }) as Parameters<typeof DELETE>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });

  it('PATCH /api/loans/[id] → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await PATCH(
      requestFor(`/api/loans/${RESOURCE_ID}`, {
        method: 'PATCH',
        ownerType: 'house',
        ownerId: HOUSE_A,
        body: { name: 'hack' },
      }) as Parameters<typeof PATCH>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });

  it('PATCH /api/loans/payments/[id] → 404 and passes User B ownerFilter', async () => {
    const response = await patchPayment(
      requestFor(`/api/loans/payments/${RESOURCE_ID}`, {
        method: 'PATCH',
        body: { action: 'MARK_PAID' },
      }) as Parameters<typeof patchPayment>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    expect(updateLoanPaymentForOwner).toHaveBeenCalledWith(
      RESOURCE_ID,
      ownerFilterB,
      expect.objectContaining({ action: 'MARK_PAID' }),
    );
  });
});
