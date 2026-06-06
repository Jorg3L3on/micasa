import { z } from 'zod';
import { dateStringSchema } from './common.schema';

export const registerPantryReceiptExpenseBodySchema = z.object({
  categoryId: z.number().int().positive(),
  walletId: z.number().int().positive(),
  date: dateStringSchema,
});

export type RegisterPantryReceiptExpenseBody = z.infer<
  typeof registerPantryReceiptExpenseBodySchema
>;
