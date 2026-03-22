import { z } from 'zod';
import { requiredStringSchema } from './common.schema';

export const createPantryProductSchema = z.object({
  name: requiredStringSchema,
  description: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  unit_label: z.string().nullable().optional(),
  default_unit_price: z.number().min(0).nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const patchPantryProductSchema = createPantryProductSchema.partial();

export type CreatePantryProductInput = z.infer<typeof createPantryProductSchema>;
export type PatchPantryProductInput = z.infer<typeof patchPantryProductSchema>;

/** Form values (react-hook-form); price is a text field for locale-friendly input */
export const pantryProductFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  unit_label: z.string().optional(),
  default_unit_price: z.string().optional(),
  active: z.boolean(),
});

export type PantryProductFormValues = z.infer<typeof pantryProductFormSchema>;
