import { z } from 'zod';

const linePatchSchema = z.object({
  id: z.number().int().positive().optional(),
  description: z.string().min(1).max(2000),
  quantity: z.number().positive().max(999999),
  unit_label: z.string().max(32).nullable().optional(),
  unit_price: z.number().nullable().optional(),
  line_total: z.number().nonnegative(),
});

export const patchPantryReceiptSchema = z.object({
  title: z.string().min(1).max(500).nullable().optional(),
  /** ISO date string (e.g. 2026-03-16) or null to clear */
  purchased_at: z.string().nullable().optional(),
  lines: z.array(linePatchSchema).min(1).optional(),
});

export type PatchPantryReceiptInput = z.infer<typeof patchPantryReceiptSchema>;
export type PantryReceiptLinePatch = z.infer<typeof linePatchSchema>;
