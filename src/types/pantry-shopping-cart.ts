import type { ShoppingStore } from '@/types/shopping-store';

export type ShoppingCartStatus =
  | 'IN_PROGRESS'
  | 'BOUGHT'
  | 'CANCELED'
  | 'ARCHIVED';

export type ShoppingCartActivityAction =
  | 'CART_CREATED'
  | 'CART_UPDATED'
  | 'CART_STATUS_CHANGED'
  | 'CART_DELETED'
  | 'ITEM_ADDED'
  | 'ITEM_UPDATED'
  | 'ITEM_CHECKED'
  | 'ITEM_UNCHECKED'
  | 'ITEM_REMOVED';

export type CartUserRef = {
  id: number;
  name: string;
};

export type PantryShoppingCartItemDto = {
  id: number;
  cart_id: number;
  product_id: number | null;
  name: string;
  quantity: number;
  unit_label: string | null;
  unit_price: number | null;
  line_total: number;
  notes: string | null;
  checked: boolean;
  sort_order: number;
  created_by: CartUserRef;
  updated_by: CartUserRef | null;
  created_at: string;
  updated_at: string;
};

export type PantryShoppingCartActivityDto = {
  id: number;
  cart_id: number;
  item_id: number | null;
  action: ShoppingCartActivityAction;
  user: CartUserRef;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type PantryShoppingCartTotalsDto = {
  items_count: number;
  checked_count: number;
  estimated_total: number;
};

export type PantryShoppingCartSummaryDto = {
  id: number;
  title: string;
  notes: string | null;
  status: ShoppingCartStatus;
  currency: string;
  store: ShoppingStore | null;
  created_by: CartUserRef;
  updated_by: CartUserRef | null;
  created_at: string;
  updated_at: string;
  totals: PantryShoppingCartTotalsDto;
};

export type PantryShoppingCartDetailDto = PantryShoppingCartSummaryDto & {
  items: PantryShoppingCartItemDto[];
};
