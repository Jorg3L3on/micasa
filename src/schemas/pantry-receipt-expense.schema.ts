import { z } from 'zod';

export const registerPantryReceiptExpenseBodySchema = z.object({
  categoryId: z.number().int().positive(),
  walletId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type RegisterPantryReceiptExpenseBody = z.infer<
  typeof registerPantryReceiptExpenseBodySchema
>;
