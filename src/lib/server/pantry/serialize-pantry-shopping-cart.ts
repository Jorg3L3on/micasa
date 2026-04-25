import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';
import type {
  PantryShoppingCartActivityDto,
  PantryShoppingCartDetailDto,
  PantryShoppingCartItemDto,
  PantryShoppingCartSummaryDto,
  ShoppingCartActivityAction,
  ShoppingCartStatus,
} from '@/types/pantry-shopping-cart';

type UserRow = { id: number; name: string };

export type ShoppingCartItemRow = {
  id: number;
  cart_id: number;
  product_id: number | null;
  name: string;
  quantity: unknown;
  unit_label: string | null;
  unit_price: unknown;
  notes: string | null;
  checked: boolean;
  sort_order: number;
  created_by: UserRow;
  updated_by: UserRow | null;
  created_at: Date;
  updated_at: Date;
};
type ItemRow = ShoppingCartItemRow;

export const computeLineTotal = (
  quantity: number,
  unitPrice: number | null,
): number => {
  if (unitPrice == null) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
};

export const serializeShoppingCartItem = (
  row: ItemRow,
): PantryShoppingCartItemDto => {
  const quantity = decimalToNumber(row.quantity) ?? 0;
  const unit_price = decimalToNumber(row.unit_price);
  return {
    id: row.id,
    cart_id: row.cart_id,
    product_id: row.product_id,
    name: row.name,
    quantity,
    unit_label: row.unit_label,
    unit_price,
    line_total: computeLineTotal(quantity, unit_price),
    notes: row.notes,
    checked: row.checked,
    sort_order: row.sort_order,
    created_by: { id: row.created_by.id, name: row.created_by.name },
    updated_by: row.updated_by
      ? { id: row.updated_by.id, name: row.updated_by.name }
      : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
};

export type ShoppingCartRow = {
  id: number;
  title: string;
  notes: string | null;
  status: ShoppingCartStatus;
  currency: string;
  created_by: UserRow;
  updated_by: UserRow | null;
  created_at: Date;
  updated_at: Date;
};
type CartRow = ShoppingCartRow;

const computeTotals = (items: PantryShoppingCartItemDto[]) => ({
  items_count: items.length,
  checked_count: items.filter((i) => i.checked).length,
  estimated_total:
    Math.round(items.reduce((acc, i) => acc + i.line_total, 0) * 100) / 100,
});

export const serializeShoppingCartSummary = (
  row: CartRow & { items: ItemRow[] },
): PantryShoppingCartSummaryDto => {
  const items = row.items.map(serializeShoppingCartItem);
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    currency: row.currency,
    created_by: { id: row.created_by.id, name: row.created_by.name },
    updated_by: row.updated_by
      ? { id: row.updated_by.id, name: row.updated_by.name }
      : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    totals: computeTotals(items),
  };
};

export const serializeShoppingCartDetail = (
  row: CartRow & { items: ItemRow[] },
): PantryShoppingCartDetailDto => {
  const items = row.items.map(serializeShoppingCartItem);
  return {
    ...serializeShoppingCartSummary(row),
    items,
  };
};

type ActivityRow = {
  id: number;
  cart_id: number;
  item_id: number | null;
  action: ShoppingCartActivityAction;
  user: UserRow;
  metadata: unknown;
  created_at: Date;
};

export const serializeShoppingCartActivity = (
  row: ActivityRow,
): PantryShoppingCartActivityDto => ({
  id: row.id,
  cart_id: row.cart_id,
  item_id: row.item_id,
  action: row.action,
  user: { id: row.user.id, name: row.user.name },
  metadata:
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as Record<string, unknown>)
      : null,
  created_at: row.created_at.toISOString(),
});
