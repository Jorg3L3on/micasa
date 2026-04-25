import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import {
  serializeShoppingCartActivity,
  serializeShoppingCartDetail,
  serializeShoppingCartItem,
  serializeShoppingCartSummary,
  type ShoppingCartItemRow,
  type ShoppingCartRow,
} from '@/lib/server/pantry/serialize-pantry-shopping-cart';
import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';
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

const USER_SELECT = { id: true, name: true } as const;

const CART_INCLUDE = {
  created_by: { select: USER_SELECT },
  updated_by: { select: USER_SELECT },
  items: {
    include: {
      created_by: { select: USER_SELECT },
      updated_by: { select: USER_SELECT },
    },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
  },
} satisfies Prisma.PantryShoppingCartInclude;

const ITEM_INCLUDE = {
  created_by: { select: USER_SELECT },
  updated_by: { select: USER_SELECT },
} satisfies Prisma.PantryShoppingCartItemInclude;

export type OwnerParams = {
  ownerType: 'user' | 'house';
  ownerId: number;
};

export class ShoppingCartNotFoundError extends Error {
  constructor(message = 'Carrito no encontrado') {
    super(message);
    this.name = 'ShoppingCartNotFoundError';
  }
}

export class ShoppingCartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShoppingCartValidationError';
  }
}

const ownerWhere = ({ ownerType, ownerId }: OwnerParams) =>
  pantryReceiptOwnerWhere(ownerType, ownerId);

export async function listShoppingCarts(
  owner: OwnerParams,
  filter: { status?: ShoppingCartStatus | null } = {},
): Promise<PantryShoppingCartSummaryDto[]> {
  const rows = await prisma.pantryShoppingCart.findMany({
    where: {
      ...ownerWhere(owner),
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: CART_INCLUDE,
    orderBy: [{ created_at: 'desc' }],
  });
  return (rows as unknown as (ShoppingCartRow & { items: ShoppingCartItemRow[] })[]).map(
    serializeShoppingCartSummary,
  );
}

export async function getShoppingCartDetail(
  owner: OwnerParams,
  cartId: number,
): Promise<PantryShoppingCartDetailDto> {
  const row = await prisma.pantryShoppingCart.findFirst({
    where: { id: cartId, ...ownerWhere(owner) },
    include: CART_INCLUDE,
  });
  if (!row) throw new ShoppingCartNotFoundError();
  return serializeShoppingCartDetail(
    row as unknown as ShoppingCartRow & { items: ShoppingCartItemRow[] },
  );
}

export async function createShoppingCart(
  owner: OwnerParams,
  userId: number,
  input: CreateShoppingCartInput,
): Promise<PantryShoppingCartDetailDto> {
  const cart = await prisma.$transaction(async (tx) => {
    const filter = ownerWhere(owner);
    const created = await tx.pantryShoppingCart.create({
      data: {
        title: input.title.trim(),
        notes: input.notes ?? null,
        currency: input.currency ?? 'MXN',
        user_id: filter.user_id,
        house_id: filter.house_id,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      },
    });
    await tx.pantryShoppingCartActivity.create({
      data: {
        cart_id: created.id,
        user_id: userId,
        action: 'CART_CREATED',
        metadata: { title: created.title },
      },
    });
    return created;
  });
  return getShoppingCartDetail(owner, cart.id);
}

export async function updateShoppingCart(
  owner: OwnerParams,
  userId: number,
  cartId: number,
  input: UpdateShoppingCartInput,
): Promise<PantryShoppingCartDetailDto> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pantryShoppingCart.findFirst({
      where: { id: cartId, ...ownerWhere(owner) },
    });
    if (!existing) throw new ShoppingCartNotFoundError();

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const data: { title?: string; notes?: string | null } = {};

    if (input.title !== undefined && input.title.trim() !== existing.title) {
      changes.title = { from: existing.title, to: input.title.trim() };
      data.title = input.title.trim();
    }
    if (input.notes !== undefined && (input.notes ?? null) !== existing.notes) {
      changes.notes = { from: existing.notes, to: input.notes ?? null };
      data.notes = input.notes ?? null;
    }

    if (Object.keys(data).length === 0) return;

    await tx.pantryShoppingCart.update({
      where: { id: cartId },
      data: { ...data, updated_by_user_id: userId },
    });
    await tx.pantryShoppingCartActivity.create({
      data: {
        cart_id: cartId,
        user_id: userId,
        action: 'CART_UPDATED',
        metadata: { changes } as Prisma.InputJsonValue,
      },
    });
  });
  return getShoppingCartDetail(owner, cartId);
}

export async function updateShoppingCartStatus(
  owner: OwnerParams,
  userId: number,
  cartId: number,
  status: ShoppingCartStatus,
): Promise<PantryShoppingCartDetailDto> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pantryShoppingCart.findFirst({
      where: { id: cartId, ...ownerWhere(owner) },
    });
    if (!existing) throw new ShoppingCartNotFoundError();
    if (existing.status === status) return;

    await tx.pantryShoppingCart.update({
      where: { id: cartId },
      data: { status, updated_by_user_id: userId },
    });
    await tx.pantryShoppingCartActivity.create({
      data: {
        cart_id: cartId,
        user_id: userId,
        action: 'CART_STATUS_CHANGED',
        metadata: { from: existing.status, to: status },
      },
    });
  });
  return getShoppingCartDetail(owner, cartId);
}

export async function deleteShoppingCart(
  owner: OwnerParams,
  userId: number,
  cartId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pantryShoppingCart.findFirst({
      where: { id: cartId, ...ownerWhere(owner) },
    });
    if (!existing) throw new ShoppingCartNotFoundError();

    await tx.pantryShoppingCartActivity.create({
      data: {
        cart_id: cartId,
        user_id: userId,
        action: 'CART_DELETED',
        metadata: { title: existing.title, status: existing.status },
      },
    });
    await tx.pantryShoppingCart.delete({ where: { id: cartId } });
  });
}

export async function addShoppingCartItem(
  owner: OwnerParams,
  userId: number,
  cartId: number,
  input: CreateShoppingCartItemInput,
): Promise<PantryShoppingCartItemDto> {
  const item = await prisma.$transaction(async (tx) => {
    const cart = await tx.pantryShoppingCart.findFirst({
      where: { id: cartId, ...ownerWhere(owner) },
    });
    if (!cart) throw new ShoppingCartNotFoundError();

    let name = input.name?.trim() ?? '';
    let unitLabel: string | null = input.unit_label ?? null;
    let unitPrice: number | null =
      input.unit_price === undefined ? null : (input.unit_price ?? null);

    if (input.product_id != null) {
      const product = await tx.pantryProduct.findFirst({
        where: { id: input.product_id, ...ownerWhere(owner) },
      });
      if (!product) {
        throw new ShoppingCartValidationError(
          'El producto no existe o no te pertenece',
        );
      }
      if (!name) name = product.name;
      if (input.unit_label === undefined)
        unitLabel = product.unit_label ?? null;
      if (input.unit_price === undefined) {
        unitPrice = decimalToNumber(product.default_unit_price);
      }
    }

    if (!name) {
      throw new ShoppingCartValidationError('El nombre es obligatorio');
    }

    const maxSort = await tx.pantryShoppingCartItem.aggregate({
      where: { cart_id: cartId },
      _max: { sort_order: true },
    });
    const nextSort = (maxSort._max.sort_order ?? -1) + 1;

    const created = await tx.pantryShoppingCartItem.create({
      data: {
        cart_id: cartId,
        product_id: input.product_id ?? null,
        name,
        quantity: input.quantity ?? 1,
        unit_label: unitLabel,
        unit_price: unitPrice,
        notes: input.notes ?? null,
        sort_order: nextSort,
        created_by_user_id: userId,
        updated_by_user_id: userId,
      },
      include: ITEM_INCLUDE,
    });

    await tx.pantryShoppingCart.update({
      where: { id: cartId },
      data: { updated_by_user_id: userId },
    });

    await tx.pantryShoppingCartActivity.create({
      data: {
        cart_id: cartId,
        item_id: created.id,
        user_id: userId,
        action: 'ITEM_ADDED',
        metadata: {
          name: created.name,
          product_id: created.product_id,
          quantity: decimalToNumber(created.quantity),
          unit_price: decimalToNumber(created.unit_price),
          unit_label: created.unit_label,
        },
      },
    });

    return created;
  });

  return serializeShoppingCartItem(item as unknown as ShoppingCartItemRow);
}

type ItemDiff = Record<string, { from: unknown; to: unknown }>;

export async function updateShoppingCartItem(
  owner: OwnerParams,
  userId: number,
  cartId: number,
  itemId: number,
  input: UpdateShoppingCartItemInput,
): Promise<PantryShoppingCartItemDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const cart = await tx.pantryShoppingCart.findFirst({
      where: { id: cartId, ...ownerWhere(owner) },
      select: { id: true },
    });
    if (!cart) throw new ShoppingCartNotFoundError();

    const existing = await tx.pantryShoppingCartItem.findFirst({
      where: { id: itemId, cart_id: cartId },
    });
    if (!existing) throw new ShoppingCartNotFoundError('Ítem no encontrado');

    const data: Record<string, unknown> = {};
    const changes: ItemDiff = {};

    if (input.product_id !== undefined) {
      const newProductId = input.product_id ?? null;
      if (newProductId !== existing.product_id) {
        if (newProductId != null) {
          const product = await tx.pantryProduct.findFirst({
            where: { id: newProductId, ...ownerWhere(owner) },
            select: { id: true },
          });
          if (!product) {
            throw new ShoppingCartValidationError(
              'El producto no existe o no te pertenece',
            );
          }
        }
        changes.product_id = {
          from: existing.product_id,
          to: newProductId,
        };
        data.product_id = newProductId;
      }
    }

    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length === 0) {
        throw new ShoppingCartValidationError('El nombre es obligatorio');
      }
      if (trimmed !== existing.name) {
        changes.name = { from: existing.name, to: trimmed };
        data.name = trimmed;
      }
    }

    if (input.quantity !== undefined) {
      const prev = decimalToNumber(existing.quantity) ?? 0;
      if (prev !== input.quantity) {
        changes.quantity = { from: prev, to: input.quantity };
        data.quantity = input.quantity;
      }
    }

    if (input.unit_label !== undefined) {
      const next = input.unit_label ?? null;
      if (next !== existing.unit_label) {
        changes.unit_label = { from: existing.unit_label, to: next };
        data.unit_label = next;
      }
    }

    if (input.unit_price !== undefined) {
      const prev = decimalToNumber(existing.unit_price);
      const next = input.unit_price ?? null;
      if (prev !== next) {
        changes.unit_price = { from: prev, to: next };
        data.unit_price = next;
      }
    }

    if (input.notes !== undefined) {
      const next = input.notes ?? null;
      if (next !== existing.notes) {
        changes.notes = { from: existing.notes, to: next };
        data.notes = next;
      }
    }

    if (input.sort_order !== undefined && input.sort_order !== existing.sort_order) {
      changes.sort_order = {
        from: existing.sort_order,
        to: input.sort_order,
      };
      data.sort_order = input.sort_order;
    }

    // `checked` toggle emits its own activity event rather than a field diff.
    let checkedChanged: boolean | null = null;
    if (input.checked !== undefined && input.checked !== existing.checked) {
      data.checked = input.checked;
      checkedChanged = input.checked;
    }

    if (Object.keys(data).length === 0) {
      return existing.id;
    }

    await tx.pantryShoppingCartItem.update({
      where: { id: itemId },
      data: { ...data, updated_by_user_id: userId },
    });

    await tx.pantryShoppingCart.update({
      where: { id: cartId },
      data: { updated_by_user_id: userId },
    });

    if (Object.keys(changes).length > 0) {
      await tx.pantryShoppingCartActivity.create({
        data: {
          cart_id: cartId,
          item_id: itemId,
          user_id: userId,
          action: 'ITEM_UPDATED',
          metadata: { name: existing.name, changes } as Prisma.InputJsonValue,
        },
      });
    }

    if (checkedChanged !== null) {
      await tx.pantryShoppingCartActivity.create({
        data: {
          cart_id: cartId,
          item_id: itemId,
          user_id: userId,
          action: checkedChanged ? 'ITEM_CHECKED' : 'ITEM_UNCHECKED',
          metadata: { name: existing.name },
        },
      });
    }

    return existing.id;
  });

  const refreshed = await prisma.pantryShoppingCartItem.findFirstOrThrow({
    where: { id: updated },
    include: ITEM_INCLUDE,
  });
  return serializeShoppingCartItem(refreshed as unknown as ShoppingCartItemRow);
}

export async function removeShoppingCartItem(
  owner: OwnerParams,
  userId: number,
  cartId: number,
  itemId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cart = await tx.pantryShoppingCart.findFirst({
      where: { id: cartId, ...ownerWhere(owner) },
      select: { id: true },
    });
    if (!cart) throw new ShoppingCartNotFoundError();

    const existing = await tx.pantryShoppingCartItem.findFirst({
      where: { id: itemId, cart_id: cartId },
    });
    if (!existing) throw new ShoppingCartNotFoundError('Ítem no encontrado');

    await tx.pantryShoppingCartActivity.create({
      data: {
        cart_id: cartId,
        item_id: itemId,
        user_id: userId,
        action: 'ITEM_REMOVED',
        metadata: {
          name: existing.name,
          quantity: decimalToNumber(existing.quantity),
          unit_price: decimalToNumber(existing.unit_price),
        },
      },
    });

    await tx.pantryShoppingCartItem.delete({ where: { id: itemId } });

    await tx.pantryShoppingCart.update({
      where: { id: cartId },
      data: { updated_by_user_id: userId },
    });
  });
}

export async function listShoppingCartActivity(
  owner: OwnerParams,
  cartId: number,
  limit = 100,
): Promise<PantryShoppingCartActivityDto[]> {
  const cart = await prisma.pantryShoppingCart.findFirst({
    where: { id: cartId, ...ownerWhere(owner) },
    select: { id: true },
  });
  if (!cart) throw new ShoppingCartNotFoundError();

  const rows = await prisma.pantryShoppingCartActivity.findMany({
    where: { cart_id: cartId },
    include: { user: { select: USER_SELECT } },
    orderBy: { created_at: 'desc' },
    take: Math.max(1, Math.min(limit, 500)),
  });
  return rows.map(serializeShoppingCartActivity);
}
