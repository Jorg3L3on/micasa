import { z } from 'zod';
import {
  requiredStringSchema,
  positiveIntSchema,
  maxAmountSchema,
  positiveAmountSchema,
  daySchema,
  optionalBooleanSchema,
  defaultBooleanSchema,
} from './common.schema';

// Expense template schemas
export const createExpenseTemplateSchema = z.object({
  name: requiredStringSchema,
  categoryId: positiveIntSchema,
  suggestedAmount: maxAmountSchema.optional(),
  paymentMethodId: positiveIntSchema.optional(),
  active: defaultBooleanSchema,
  expenseIds: z.array(positiveIntSchema).optional().default([]),
  dueDay: daySchema,
  cutoffDay: daySchema,
  isRecurring: z.boolean(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  isSubscription: z.boolean(),
});

export const updateExpenseTemplateSchema = z.object({
  name: requiredStringSchema.optional(),
  categoryId: positiveIntSchema.optional(),
  suggestedAmount: positiveAmountSchema.optional(),
  paymentMethodId: positiveIntSchema.optional().nullable(),
  active: optionalBooleanSchema,
  expenseIds: z.array(positiveIntSchema).optional(),
  dueDay: positiveIntSchema.optional(),
  cutoffDay: positiveIntSchema.optional(),
  isRecurring: z.boolean().optional(),
  appliesFirstFortnight: z.boolean().optional(),
  appliesSecondFortnight: z.boolean().optional(),
  isSubscription: z.boolean().optional(),
});

export const expenseTemplateSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  categoryId: z.number().int().positive('Categoría es requerida'),
  suggestedAmount: z
    .number()
    .positive()
    .max(99999999.99, 'El monto es demasiado grande')
    .optional()
    .nullable(),
  paymentMethodId: z.number().int().positive().optional().nullable(),
  active: z.boolean(),
  dueDay: z
    .number()
    .int()
    .min(1, 'El día de vencimiento debe estar entre 1 y 31')
    .max(31, 'El día de vencimiento debe estar entre 1 y 31'),
  cutoffDay: z
    .number()
    .int()
    .min(1, 'El día de corte debe estar entre 1 y 31')
    .max(31, 'El día de corte debe estar entre 1 y 31'),
  isRecurring: z.boolean(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  isSubscription: z.boolean(),
});

// Type exports
export type CreateExpenseTemplateInput = z.infer<typeof createExpenseTemplateSchema>;
export type UpdateExpenseTemplateInput = z.infer<typeof updateExpenseTemplateSchema>;
export type ExpenseTemplateFormValues = z.infer<typeof expenseTemplateSchema>;
