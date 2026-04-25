import { z } from 'zod';

export const shoppingCartStatusSchema = z.enum([
  'IN_PROGRESS',
  'BOUGHT',
  'CANCELED',
  'ARCHIVED',
]);

export type ShoppingCartStatus = z.infer<typeof shoppingCartStatusSchema>;

const optionalTrimmedString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional();

export const createShoppingCartSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(120),
  notes: optionalTrimmedString,
  currency: z.string().min(1).max(8).optional(),
});
export type CreateShoppingCartInput = z.infer<typeof createShoppingCartSchema>;

export const updateShoppingCartSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    notes: optionalTrimmedString,
  })
  .refine(
    (v) => v.title !== undefined || v.notes !== undefined,
    'No hay cambios',
  );
export type UpdateShoppingCartInput = z.infer<typeof updateShoppingCartSchema>;

export const updateShoppingCartStatusSchema = z.object({
  status: shoppingCartStatusSchema,
});
export type UpdateShoppingCartStatusInput = z.infer<
  typeof updateShoppingCartStatusSchema
>;

export const createShoppingCartItemSchema = z
  .object({
    product_id: z.number().int().positive().nullable().optional(),
    name: z.string().min(1).max(200).optional(),
    quantity: z.number().positive().max(999_999).optional(),
    unit_label: optionalTrimmedString,
    unit_price: z.number().min(0).max(9_999_999.99).nullable().optional(),
    notes: optionalTrimmedString,
  })
  .refine(
    (v) =>
      (v.product_id != null && v.product_id > 0) ||
      (typeof v.name === 'string' && v.name.trim().length > 0),
    'Debes elegir un producto o escribir un nombre',
  );
export type CreateShoppingCartItemInput = z.infer<
  typeof createShoppingCartItemSchema
>;

export const updateShoppingCartItemSchema = z
  .object({
    product_id: z.number().int().positive().nullable().optional(),
    name: z.string().min(1).max(200).optional(),
    quantity: z.number().positive().max(999_999).optional(),
    unit_label: optionalTrimmedString,
    unit_price: z.number().min(0).max(9_999_999.99).nullable().optional(),
    notes: optionalTrimmedString,
    checked: z.boolean().optional(),
    sort_order: z.number().int().min(0).max(100_000).optional(),
  })
  .refine(
    (v) => Object.values(v).some((x) => x !== undefined),
    'No hay cambios',
  );
export type UpdateShoppingCartItemInput = z.infer<
  typeof updateShoppingCartItemSchema
>;
