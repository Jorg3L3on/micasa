import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  RESOURCE_ID,
  USER_A,
  assertIsolationDenied,
  contextUserB,
  forbiddenHouseContext,
  ownerFilterB,
  ownerScopedFindFirst,
  paramsOf,
  requestFor,
} from '@/test/isolation/helpers';

const {
  getOwnerContext,
  findFirstWallet,
  updateWalletMetadataForOwner,
  deleteWalletIfUnusedForOwner,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFirstWallet: vi.fn(),
  updateWalletMetadataForOwner: vi.fn(),
  deleteWalletIfUnusedForOwner: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findFirst: findFirstWallet },
  },
}));

vi.mock('@/lib/finance/wallet.service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/finance/wallet.service')>();
  return {
    ...actual,
    updateWalletMetadataForOwner,
    deleteWalletIfUnusedForOwner,
  };
});

import { GET } from '@/app/api/wallets/[id]/route';
import { GET as getMovements } from '@/app/api/wallets/[id]/movements/route';
import { POST as importCsv } from '@/app/api/wallets/[id]/import/route';
import { PUT, DELETE } from '@/app/api/wallets/route';

const foreignWallet = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  name: 'SECRET_WALLET_A',
  provider_icon_key: null,
  type: 'CASH',
  amount: 5000,
  credit_limit: null,
  temporary_credit_limit: null,
  active: true,
};

const notFound = () => {
  const error = new Error('Wallet not found') as Error & { code?: string };
  error.code = 'P2025';
  return error;
};

describe('isolation: wallets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    findFirstWallet.mockImplementation(ownerScopedFindFirst(foreignWallet));
    updateWalletMetadataForOwner.mockRejectedValue(notFound());
    deleteWalletIfUnusedForOwner.mockRejectedValue(notFound());
  });

  it('GET /api/wallets/[id] → 404 for User A wallet under User B context', async () => {
    const response = await GET(
      requestFor(`/api/wallets/${RESOURCE_ID}`) as Parameters<typeof GET>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_WALLET_A');
  });

  it('GET /api/wallets/[id] → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await GET(
      requestFor(`/api/wallets/${RESOURCE_ID}`, {
        ownerType: 'house',
        ownerId: HOUSE_A,
      }) as Parameters<typeof GET>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });

  it('GET /api/wallets/[id]/movements → 404 for User A wallet', async () => {
    const response = await getMovements(
      requestFor(`/api/wallets/${RESOURCE_ID}/movements`) as Parameters<
        typeof getMovements
      >[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_WALLET_A');
  });

  it('POST /api/wallets/[id]/import → 404 for User A wallet', async () => {
    const response = await importCsv(
      requestFor(`/api/wallets/${RESOURCE_ID}/import`, {
        method: 'POST',
        body: { csv: 'date,description,amount,category,type\n' },
      }) as Parameters<typeof importCsv>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
  });

  it('PUT /api/wallets?id= → 404 and passes User B ownerFilter', async () => {
    const response = await PUT(
      requestFor('/api/wallets', {
        method: 'PUT',
        searchParams: { id: String(RESOURCE_ID) },
        body: { name: 'hack' },
      }) as Parameters<typeof PUT>[0],
    );

    expect(response.status).toBe(404);
    expect(updateWalletMetadataForOwner).toHaveBeenCalledWith(
      RESOURCE_ID,
      expect.objectContaining({ name: 'hack' }),
      ownerFilterB,
    );
  });

  it('DELETE /api/wallets?id= → 404 for User A wallet', async () => {
    const response = await DELETE(
      requestFor('/api/wallets', {
        method: 'DELETE',
        searchParams: { id: String(RESOURCE_ID) },
      }) as Parameters<typeof DELETE>[0],
    );

    expect(response.status).toBe(404);
    expect(deleteWalletIfUnusedForOwner).toHaveBeenCalledWith(
      RESOURCE_ID,
      ownerFilterB,
    );
  });
});
