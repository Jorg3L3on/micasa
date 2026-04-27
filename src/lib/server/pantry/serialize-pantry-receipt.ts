import type { PantryReceiptDetailDto } from '@/types/pantry-receipt';
import {
  extractLinkedCartIdFromWarnings,
  stripReceiptSystemWarnings,
} from '@/lib/server/pantry/pantry-receipt-links';

export const decimalToNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const serializeLines = (
  lines: Array<{
    id: number;
    receipt_id: number;
    sort_order: number;
    description: string;
    quantity: unknown;
    unit_label: string | null;
    unit_price: unknown;
    line_total: unknown;
  }>,
) =>
  lines.map((l) => ({
    id: l.id,
    receipt_id: l.receipt_id,
    sort_order: l.sort_order,
    description: l.description,
    quantity: decimalToNumber(l.quantity) ?? 0,
    unit_label: l.unit_label,
    unit_price: decimalToNumber(l.unit_price),
    line_total: decimalToNumber(l.line_total) ?? 0,
  }));

export const serializePantryReceiptDetail = (r: {
  id: number;
  title: string | null;
  store: string | null;
  merchant_ref: string | null;
  currency: string;
  purchased_at: Date | null;
  subtotal: unknown;
  discount_total: unknown;
  delivery_fee: unknown;
  grand_total: unknown;
  file_name: string | null;
  file_mime: string | null;
  file_data: Uint8Array | null;
  parse_warnings: string[];
  created_at: Date;
  updated_at: Date;
  created_by_user_id: number;
  lines: Parameters<typeof serializeLines>[0];
}): PantryReceiptDetailDto => ({
  id: r.id,
  title: r.title,
  store: r.store as PantryReceiptDetailDto['store'],
  merchant_ref: r.merchant_ref,
  currency: r.currency,
  purchased_at: r.purchased_at?.toISOString() ?? null,
  subtotal: decimalToNumber(r.subtotal),
  discount_total: decimalToNumber(r.discount_total),
  delivery_fee: decimalToNumber(r.delivery_fee),
  grand_total: decimalToNumber(r.grand_total),
  file_name: r.file_name,
  file_mime: r.file_mime,
  has_file: r.file_data != null && r.file_data.length > 0,
  linked_cart_id: extractLinkedCartIdFromWarnings(r.parse_warnings),
  parse_warnings: stripReceiptSystemWarnings(r.parse_warnings),
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
  created_by_user_id: r.created_by_user_id,
  lines: serializeLines(r.lines),
});
