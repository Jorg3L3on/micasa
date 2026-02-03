import { z } from 'zod';
import {
  requiredStringSchema,
  positiveIntSchema,
  maxAmountSchema,
  positiveAmountSchema,
  optionalBooleanSchema,
  defaultBooleanSchema,
} from './common.schema';

export const createIncomeTemplateSchema = z.object({
  name: requiredStringSchema,
  suggestedAmount: maxAmountSchema.optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  active: defaultBooleanSchema,
  userId: positiveIntSchema.optional().nullable(),
});

export const updateIncomeTemplateSchema = z.object({
  name: requiredStringSchema.optional(),
  suggestedAmount: positiveAmountSchema.optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  appliesFirstFortnight: z.boolean().optional(),
  appliesSecondFortnight: z.boolean().optional(),
  active: optionalBooleanSchema,
  userId: positiveIntSchema.optional().nullable(),
});

export const incomeTemplateSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  suggestedAmount: z
    .number()
    .positive()
    .max(99999999.99, 'El monto es demasiado grande')
    .optional()
    .nullable(),
  source: z.string().max(255).optional().nullable(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  active: z.boolean(),
  userId: z.number().int().positive().optional().nullable(),
});

export type CreateIncomeTemplateInput = z.infer<
  typeof createIncomeTemplateSchema
>;
export type UpdateIncomeTemplateInput = z.infer<
  typeof updateIncomeTemplateSchema
>;
export type IncomeTemplateFormValues = z.infer<typeof incomeTemplateSchema>;
