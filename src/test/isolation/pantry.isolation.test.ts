import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOUSE_A,
  RESOURCE_ID,
  USER_A,
  USER_B,
  assertIsolationDenied,
  contextUserB,
  forbiddenHouseContext,
  ownerScopedFindFirst,
  paramsOf,
  requestFor,
} from '@/test/isolation/helpers';
import { ShoppingCartNotFoundError } from '@/lib/server/pantry/shopping-cart.service';

const {
  getOwnerContext,
  findFirstReceipt,
  findFirstProduct,
  getShoppingCartDetail,
  authMock,
} = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  findFirstReceipt: vi.fn(),
  findFirstProduct: vi.fn(),
  getShoppingCartDetail: vi.fn(),
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
    pantryReceipt: { findFirst: findFirstReceipt },
    pantryProduct: { findFirst: findFirstProduct },
  },
}));

vi.mock('@/lib/server/pantry/shopping-cart.service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/lib/server/pantry/shopping-cart.service')
    >();
  return {
    ...actual,
    getShoppingCartDetail,
  };
});

import { GET as getReceipt } from '@/app/api/pantry/receipts/[id]/route';
import { DELETE as deleteProduct } from '@/app/api/pantry/products/[id]/route';
import { GET as getCart } from '@/app/api/pantry/shopping-carts/[id]/route';

const foreignReceipt = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  store_name: 'SECRET_RECEIPT_A',
  lines: [],
  linked_expense: null,
};

const foreignProduct = {
  id: RESOURCE_ID,
  user_id: USER_A,
  house_id: null,
  name: 'SECRET_PRODUCT_A',
};

describe('isolation: pantry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(contextUserB);
    findFirstReceipt.mockImplementation(ownerScopedFindFirst(foreignReceipt));
    findFirstProduct.mockImplementation(ownerScopedFindFirst(foreignProduct));
    getShoppingCartDetail.mockImplementation(
      async (owner: { ownerType: string; ownerId: number }) => {
        if (owner.ownerType === 'user' && owner.ownerId === USER_B) {
          throw new ShoppingCartNotFoundError();
        }
        return { id: RESOURCE_ID, name: 'SECRET_CART_A' };
      },
    );
  });

  it('GET /api/pantry/receipts/[id] → 404 for User A receipt under User B context', async () => {
    const response = await getReceipt(
      requestFor(`/api/pantry/receipts/${RESOURCE_ID}`) as Parameters<
        typeof getReceipt
      >[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_RECEIPT_A');
  });

  it('GET receipt → 403 when house context is forbidden', async () => {
    getOwnerContext.mockResolvedValue(forbiddenHouseContext);

    const response = await getReceipt(
      requestFor(`/api/pantry/receipts/${RESOURCE_ID}`, {
        ownerType: 'house',
        ownerId: HOUSE_A,
      }) as Parameters<typeof getReceipt>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(403);
  });

  it('DELETE /api/pantry/products/[id] → 404 for User A product', async () => {
    const response = await deleteProduct(
      requestFor(`/api/pantry/products/${RESOURCE_ID}`, {
        method: 'DELETE',
      }) as Parameters<typeof deleteProduct>[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_PRODUCT_A');
  });

  it('GET /api/pantry/shopping-carts/[id] → 404 for User A cart', async () => {
    const response = await getCart(
      requestFor(`/api/pantry/shopping-carts/${RESOURCE_ID}`) as Parameters<
        typeof getCart
      >[0],
      { params: paramsOf(RESOURCE_ID) },
    );

    expect(response.status).toBe(404);
    await assertIsolationDenied(response.clone(), 'SECRET_CART_A');
  });
});
