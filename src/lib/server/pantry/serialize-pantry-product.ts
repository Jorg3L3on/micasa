import { decimalToNumber } from '@/lib/server/pantry/serialize-pantry-receipt';
import type { PantryProductDto } from '@/types/pantry-product';

type PantryProductRow = {
  id: number;
  name: string;
  description: string | null;
  barcode: string | null;
  brand: string | null;
  unit_label: string | null;
  default_unit_price: unknown;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export const serializePantryProduct = (row: PantryProductRow): PantryProductDto => ({
  id: row.id,
  name: row.name,
  description: row.description,
  barcode: row.barcode,
  brand: row.brand,
  unit_label: row.unit_label,
  default_unit_price: decimalToNumber(row.default_unit_price),
  active: row.active,
  created_at: row.created_at.toISOString(),
  updated_at: row.updated_at.toISOString(),
});
