import type { Prisma } from '@/generated/prisma/client';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import prisma from '@/lib/prisma';
import { pantryReceiptOwnerWhere } from '@/lib/server/pantry/pantry-receipt-owner';
import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';

export type ReceiptLineLike = {
  description: string;
  unit_label?: string | null;
  unit_price?: number | null;
};

const normalizeProductName = (raw: string): string | null => {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length === 0) return null;
  return name;
};

const normalizeProductKey = (raw: string): string | null => {
  const name = normalizeProductName(raw);
  if (!name) return null;
  return name.toLowerCase();
};

const normalizeUnitLabel = (value: string | null): string | null => {
  const cleaned = value?.trim() ?? '';
  if (!cleaned) return null;
  const normalized = cleaned.toLowerCase();
  if (normalized === 'pieza' || normalized === 'pza') return 'pz';
  if (normalized === 'kilo' || normalized === 'kilogramo') return 'kg';
  return normalized;
};

const trimToNull = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
};

const roundMoney = (n: number): number => Math.round(n * 100) / 100;

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Upserts pantry catalog rows from receipt line items (same owner as the receipt).
 * Call after each import or line edit. New products use line description as name;
 * existing products get unit_label / default_unit_price refreshed when the line provides them.
 */
export const syncPantryProductsFromReceiptLines = async (params: {
  ownerType: 'user' | 'house';
  ownerId: number;
  ownerFilter: OwnerFilter;
  lines: ReceiptLineLike[];
  db?: DbClient;
}): Promise<void> => {
  const client = params.db ?? prisma;
  const { ownerFilter, ownerType, ownerId, lines } = params;

  for (const line of lines) {
    const name = normalizeProductName(line.description);
    const normalizedName = normalizeProductKey(line.description);
    if (!name) continue;

    const unitLabel = trimToNull(line.unit_label ?? null);
    const normalizedUnit = normalizeUnitLabel(unitLabel);
    const unitPrice =
      line.unit_price != null && Number.isFinite(line.unit_price)
        ? roundMoney(line.unit_price)
        : null;

    const existing = await client.pantryProduct.findFirst({
      where: {
        normalized_name: normalizedName,
        ...pantryReceiptOwnerWhere(ownerType, ownerId),
      },
    });

    if (!existing) {
      await client.pantryProduct.create({
        data: {
          name,
          user_id: ownerFilter.user_id,
          house_id: ownerFilter.house_id,
          unit_label: unitLabel,
          normalized_name: normalizedName,
          normalized_unit: normalizedUnit,
          default_unit_price: unitPrice,
          active: true,
        },
      });
      continue;
    }

    const data: {
      unit_label?: string | null;
      normalized_unit?: string | null;
      normalized_name?: string | null;
      default_unit_price?: number | null;
    } = {};

    if (unitLabel != null) {
      data.unit_label = unitLabel;
    }
    if (normalizedUnit != null) {
      data.normalized_unit = normalizedUnit;
    }
    if (normalizedName != null) {
      data.normalized_name = normalizedName;
    }
    if (unitPrice != null) {
      data.default_unit_price = unitPrice;
    }

    if (Object.keys(data).length === 0) continue;

    await client.pantryProduct.update({
      where: { id: existing.id },
      data,
    });
  }
};

/**
 * Replays all saved receipts (oldest → newest) so catalog reflects latest prices per product name.
 */
export const backfillPantryProductsFromAllReceipts = async (): Promise<{
  receiptCount: number;
}> => {
  const receipts = await prisma.pantryReceipt.findMany({
    include: { lines: { orderBy: { sort_order: 'asc' } } },
    orderBy: { created_at: 'asc' },
  });

  for (const r of receipts) {
    const userId = r.user_id;
    const houseId = r.house_id;
    if (userId == null && houseId == null) continue;

    const ownerType = userId != null ? 'user' : 'house';
    const ownerId = userId != null ? userId : houseId!;
    const ownerFilter: OwnerFilter =
      ownerType === 'user'
        ? { user_id: ownerId, house_id: null }
        : { user_id: null, house_id: ownerId };

    await syncPantryProductsFromReceiptLines({
      ownerType,
      ownerId,
      ownerFilter,
      lines: r.lines.map((l) => ({
        description: l.description,
        unit_label: l.unit_label,
        unit_price: decimalToNumber(l.unit_price),
      })),
    });
  }

  return { receiptCount: receipts.length };
};
