'use client';

import type { FinanceContextType } from '@/types/finance-context';
import type {
  PantryReceiptDetailDto,
  PantryReceiptListItemDto,
} from '@/types/pantry-receipt';
import type { PantryInsightsDto } from '@/types/pantry-insights';
import type { PatchPantryReceiptInput } from '@/schemas/pantry-receipt.schema';
import type { RegisterPantryReceiptExpenseBody } from '@/schemas/pantry-receipt-expense.schema';
import type {
  CreatePantryProductInput,
  PatchPantryProductInput,
} from '@/schemas/pantry-product.schema';
import type { PantryProductDto } from '@/types/pantry-product';
import type {
  CreateShoppingCartInput,
  CreateShoppingCartItemInput,
  UpdateShoppingCartInput,
  UpdateShoppingCartItemInput,
} from '@/schemas/pantry-shopping-cart.schema';
import type {
  PantryShoppingCartActivityDto,
  PantryShoppingCartDetailDto,
  PantryShoppingCartItemDto,
  PantryShoppingCartSummaryDto,
  ShoppingCartStatus,
} from '@/types/pantry-shopping-cart';
import { clientFetchFromApi, clientFetchMultipartJson } from '@/lib/api/client-fetch';

export async function listPantryReceipts(
  context?: FinanceContextType,
): Promise<PantryReceiptListItemDto[]> {
  return clientFetchFromApi<PantryReceiptListItemDto[]>(
    '/api/pantry/receipts',
    undefined,
    context,
  );
}

export async function getPantryInsights(
  context?: FinanceContextType,
): Promise<PantryInsightsDto> {
  return clientFetchFromApi<PantryInsightsDto>(
    '/api/pantry/insights',
    undefined,
    context,
  );
}

export async function uploadPantryReceipt(
  formData: FormData,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchMultipartJson<PantryReceiptDetailDto>(
    '/api/pantry/receipts',
    formData,
    context,
  );
}

export async function getPantryReceipt(
  id: number,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchFromApi<PantryReceiptDetailDto>(
    `/api/pantry/receipts/${id}`,
    undefined,
    context,
  );
}

export async function patchPantryReceipt(
  id: number,
  body: PatchPantryReceiptInput,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchFromApi<PantryReceiptDetailDto>(
    `/api/pantry/receipts/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function registerPantryReceiptExpense(
  id: number,
  body: RegisterPantryReceiptExpenseBody,
  context?: FinanceContextType,
): Promise<PantryReceiptDetailDto> {
  return clientFetchFromApi<PantryReceiptDetailDto>(
    `/api/pantry/receipts/${id}/expense`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function reconcilePantryReceiptToCart(
  id: number,
  body: { cart_id?: number; apply?: boolean },
  context?: FinanceContextType,
): Promise<{
  cart_id: number;
  receipt_id: number;
  matched_count: number;
  missing_count: number;
  total_receipt_lines: number;
  applied: boolean;
}> {
  return clientFetchFromApi(
    `/api/pantry/receipts/${id}/reconcile`,
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function deletePantryReceipt(
  id: number,
  context?: FinanceContextType,
): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/pantry/receipts/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listPantryProducts(
  context?: FinanceContextType,
): Promise<PantryProductDto[]> {
  return clientFetchFromApi<PantryProductDto[]>(
    '/api/pantry/products',
    undefined,
    context,
  );
}

export async function createPantryProduct(
  body: CreatePantryProductInput,
  context?: FinanceContextType,
): Promise<PantryProductDto> {
  return clientFetchFromApi<PantryProductDto>(
    '/api/pantry/products',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function patchPantryProduct(
  id: number,
  body: PatchPantryProductInput,
  context?: FinanceContextType,
): Promise<PantryProductDto> {
  return clientFetchFromApi<PantryProductDto>(
    `/api/pantry/products/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    context,
  );
}

export async function deletePantryProduct(
  id: number,
  context?: FinanceContextType,
): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/pantry/products/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listShoppingCarts(
  context?: FinanceContextType,
  status?: ShoppingCartStatus | 'ALL',
): Promise<PantryShoppingCartSummaryDto[]> {
  const qs = status && status !== 'ALL' ? `?status=${status}` : '';
  return clientFetchFromApi<PantryShoppingCartSummaryDto[]>(
    `/api/pantry/shopping-carts${qs}`,
    undefined,
    context,
  );
}

export async function getShoppingCart(
  id: number,
  context?: FinanceContextType,
): Promise<PantryShoppingCartDetailDto> {
  return clientFetchFromApi<PantryShoppingCartDetailDto>(
    `/api/pantry/shopping-carts/${id}`,
    undefined,
    context,
  );
}

export async function createShoppingCart(
  body: CreateShoppingCartInput,
  context?: FinanceContextType,
): Promise<PantryShoppingCartDetailDto> {
  return clientFetchFromApi<PantryShoppingCartDetailDto>(
    '/api/pantry/shopping-carts',
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function updateShoppingCart(
  id: number,
  body: UpdateShoppingCartInput,
  context?: FinanceContextType,
): Promise<PantryShoppingCartDetailDto> {
  return clientFetchFromApi<PantryShoppingCartDetailDto>(
    `/api/pantry/shopping-carts/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    context,
  );
}

export async function deleteShoppingCart(
  id: number,
  context?: FinanceContextType,
): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/pantry/shopping-carts/${id}`,
    { method: 'DELETE' },
    context,
  );
}

export async function updateShoppingCartStatus(
  id: number,
  status: ShoppingCartStatus,
  context?: FinanceContextType,
): Promise<PantryShoppingCartDetailDto> {
  return clientFetchFromApi<PantryShoppingCartDetailDto>(
    `/api/pantry/shopping-carts/${id}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
    context,
  );
}

export async function addShoppingCartItem(
  cartId: number,
  body: CreateShoppingCartItemInput,
  context?: FinanceContextType,
): Promise<PantryShoppingCartItemDto> {
  return clientFetchFromApi<PantryShoppingCartItemDto>(
    `/api/pantry/shopping-carts/${cartId}/items`,
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function addShoppingCartItemsBulk(
  cartId: number,
  body: {
    items: Array<{
      name: string;
      quantity?: number;
      unit_label?: string | null;
      unit_price?: number | null;
      notes?: string | null;
    }>;
    checked?: boolean;
  },
  context?: FinanceContextType,
): Promise<{ created_count: number }> {
  return clientFetchFromApi<{ created_count: number }>(
    `/api/pantry/shopping-carts/${cartId}/items/bulk`,
    { method: 'POST', body: JSON.stringify(body) },
    context,
  );
}

export async function updateShoppingCartItem(
  cartId: number,
  itemId: number,
  body: UpdateShoppingCartItemInput,
  context?: FinanceContextType,
): Promise<PantryShoppingCartItemDto> {
  return clientFetchFromApi<PantryShoppingCartItemDto>(
    `/api/pantry/shopping-carts/${cartId}/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    context,
  );
}

export async function checkAllShoppingCartItems(
  cartId: number,
  context?: FinanceContextType,
): Promise<{ checked_count: number }> {
  return clientFetchFromApi<{ checked_count: number }>(
    `/api/pantry/shopping-carts/${cartId}/check-all`,
    { method: 'PATCH' },
    context,
  );
}

export async function deleteShoppingCartItem(
  cartId: number,
  itemId: number,
  context?: FinanceContextType,
): Promise<void> {
  await clientFetchFromApi<{ ok: boolean }>(
    `/api/pantry/shopping-carts/${cartId}/items/${itemId}`,
    { method: 'DELETE' },
    context,
  );
}

export async function listShoppingCartActivity(
  cartId: number,
  context?: FinanceContextType,
  limit = 100,
): Promise<PantryShoppingCartActivityDto[]> {
  return clientFetchFromApi<PantryShoppingCartActivityDto[]>(
    `/api/pantry/shopping-carts/${cartId}/activity?limit=${limit}`,
    undefined,
    context,
  );
}
