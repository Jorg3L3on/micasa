import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  RESOURCE_ID,
  USER_A,
  USER_B,
  contextUserB,
  forbiddenHouseContext,
  ownerFilterB,
  paramsOf,
  requestFor,
} from '@/test/isolation/helpers';

const {
  getOwnerContext,
  getCreditCardByOwner,
  updateCreditCardForOwner,
  listCreditCardPaymentsByOwner,
  findFirstWallet,
  findManyImports,
  authMock,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  getCreditCardByOwner: vi.fn(),
  updateCreditCardForOwner: vi.fn(),
  listCreditCardPaymentsByOwner: vi.fn(),
  findFirstWallet: vi.fn(),
  findManyImports: vi.fn(),
  authMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findFirst: findFirstWallet },
    creditCardStatementImport: { findMany: findManyImports },
  },
}));

vi.mock('@/lib/finance/credit-card.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/credit-card.service')>();
  return {
    ...actual,
    getCreditCardByOwner,
    updateCreditCardForOwner,
    listCreditCardPaymentsByOwner,
  };
});

import { GET, PATCH } from '@/app/api/credit-cards/[id]/route';
import { GET as getPayments } from '@/app/api/credit-cards/[id]/payments/route';
import { GET as getStatementImports } from '@/app/api/credit-cards/[id]/statement-imports/route';

const notFoundError = () => {
  const error = new Error('Tarjeta no encontrada') as Error & { code?: string };
  error.code = 'P2025';
  return error;
};

const foreignCardWallet = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  type: 'CREDIT_CARD',
  name: 'SECRET_CARD_A',
};

describe('isolation: credit cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    getCreditCardByOwner.mockImplementation(
      async (_id: number, filter: { user_id: number | null }) => {
        if (filter.user_id === USER_B) throw notFoundError();
        return { id: RESOURCE_ID, name: 'SECRET_CARD_A' };
      },
    );
    updateCreditCardForOwner.mockImplementation(
      async (_id: number, _data: unknown, filter: { user_id: number | null }) => {
        if (filter.user_id === USER_B) throw notFoundError();
        return { id: RESOURCE_ID, name: 'SECRET_CARD_A' };
      },
    );
    listCreditCardPaymentsByOwner.mockImplementation(
      async (_id: number, filter: { user_id: number | null }) => {
        if (filter.user_id === USER_B) throw notFoundError();
        return [{ id: 1, amount: 999, note: 'SECRET_PAYMENT_A' }];
      },
    );
    findFirstWallet.mockImplementation(async (args?: { where?: Record<string, unknown> }) => {
      const where = args?.where ?? {};
      // statement-imports adds type: { in: [...] } — still requires owner fields
      const hasUser = Object.prototype.hasOwnProperty.call(where, 'user_id');
      const hasHouse = Object.prototype.hasOwnProperty.call(where, 'house_id');
      if (!hasUser || !hasHouse) return foreignCardWallet;
      if (
        where.id === foreignCardWallet.id &&
        where.user_id === foreignCardWallet.user_id &&
        where.house_id === foreignCardWallet.house_id
      ) {
        return { id: foreignCardWallet.id };
      }
      return null;
    });
    findManyImports.mockResolvedValue([]);
  });

  it('GET /api/credit-cards/[id] → 404 for User A card under User B context', async () => {
    const response = await GET(
      requestFor(`/api/credit-cards/${RESOURCE_ID}`) as Parameters<typeof GET>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    expect(getCreditCardByOwner).toHaveBeenCalledWith(RESOURCE_ID, ownerFilterB);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('SECRET_CARD_A');
  });

  it('PATCH /api/credit-cards/[id] → 404 for User A card', async () => {
    const response = await PATCH(
      requestFor(`/api/credit-cards/${RESOURCE_ID}`, {
        method: 'PATCH',
        body: { name: 'hack' },
      }) as Parameters<typeof PATCH>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });

  it('GET → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await GET(
      requestFor(`/api/credit-cards/${RESOURCE_ID}`, {
        ownerType: 'house',
        ownerId: HOUSE_A,
      }) as Parameters<typeof GET>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });

  it('GET /api/credit-cards/[id]/payments → 404 when card not owned', async () => {
    const response = await getPayments(
      requestFor(`/api/credit-cards/${RESOURCE_ID}/payments`) as Parameters<
        typeof getPayments
      >[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    expect(listCreditCardPaymentsByOwner).toHaveBeenCalledWith(
      RESOURCE_ID,
      ownerFilterB,
    );
  });

  it('GET /api/credit-cards/[id]/statement-imports → 404 when card not owned', async () => {
    const response = await getStatementImports(
      requestFor(
        `/api/credit-cards/${RESOURCE_ID}/statement-imports`,
      ) as Parameters<typeof getStatementImports>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    expect(findManyImports).not.toHaveBeenCalled();
  });
});
