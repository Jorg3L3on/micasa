import { z } from 'zod';
import {
  requiredStringSchema,
  positiveIntSchema,
  positiveAmountSchema,
  optionalBooleanSchema,
  defaultBooleanSchema,
} from './common.schema';

// Expense schemas
export const createExpenseSchema = z.object({
  name: requiredStringSchema,
  categoryId: positiveIntSchema,
  defaultAmount: positiveAmountSchema.optional(),
  paymentMethodId: positiveIntSchema,
  active: defaultBooleanSchema,
});

export const updateExpenseSchema = z.object({
  name: requiredStringSchema.optional(),
  categoryId: positiveIntSchema.optional(),
  defaultAmount: positiveAmountSchema.optional().nullable(),
  paymentMethodId: positiveIntSchema.optional(),
  active: optionalBooleanSchema,
});

export const expenseSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  categoryId: z.number().int().positive('Categoría es requerida'),
  defaultAmount: z.number().positive().optional().nullable(),
  paymentMethodId: z.number().int().positive('Método de pago es requerido'),
  active: z.boolean(),
});

export const expenseAmountSchema = z.object({
  amount: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  wallet_id: z.number().int().positive().nullable().optional(),
});

// Type exports
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseFormValues = z.infer<typeof expenseSchema>;
export type ExpenseAmountFormValues = z.infer<typeof expenseAmountSchema>;
