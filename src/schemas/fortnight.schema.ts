import { z } from 'zod';
import {
  monthSchema,
  yearSchema,
} from './common.schema';

// Fortnight period enum
export const fortnightPeriodSchema = z.enum(['FIRST', 'SECOND'], {
  message: 'Período es requerido',
});

export const overrideAmountSchema = z.object({
  amount: z.number().min(0, 'Amount must be greater than or equal to 0'),
  year: yearSchema,
  month: monthSchema,
});

/** Form-only schema for the edit-income dialog (year/month are added by the parent). */
export const overrideAmountFormSchema = z.object({
  amount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  categoryId: z.number().int().positive().optional().nullable(),
  walletId: z.number().int().positive().optional().nullable(),
});

export type OverrideAmountFormOptions = {
  requireCategory: boolean;
  requireWallet: boolean;
};

export function createOverrideAmountFormSchema({
  requireCategory,
  requireWallet,
}: OverrideAmountFormOptions) {
  return z.object({
    amount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
    categoryId: requireCategory
      ? z.number().int().positive('La categoría es requerida')
      : z.number().int().positive().optional().nullable(),
    walletId: requireWallet
      ? z
          .number()
          .int()
          .positive()
          .nullable()
          .optional()
          .refine((value) => value != null && value > 0, {
            message: 'Selecciona una billetera de efectivo o débito',
          })
      : z.number().int().positive().optional().nullable(),
  });
}

export type OverrideAmountInput = z.infer<typeof overrideAmountSchema>;
export type OverrideAmountFormValues = z.infer<typeof overrideAmountFormSchema>;
