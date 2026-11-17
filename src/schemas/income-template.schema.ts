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
  categoryId: positiveIntSchema,
  walletId: positiveIntSchema.optional().nullable(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  active: defaultBooleanSchema,
  userId: positiveIntSchema.optional().nullable(),
});

export const updateIncomeTemplateSchema = z.object({
  name: requiredStringSchema.optional(),
  suggestedAmount: positiveAmountSchema.optional().nullable(),
  source: z.string().max(255).optional().nullable(),
  categoryId: positiveIntSchema.optional(),
  walletId: positiveIntSchema.optional().nullable(),
  appliesFirstFortnight: z.boolean().optional(),
  appliesSecondFortnight: z.boolean().optional(),
  active: optionalBooleanSchema,
  userId: positiveIntSchema.optional().nullable(),
});

const incomeTemplateFieldsSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  suggestedAmount: z
    .number()
    .positive()
    .max(99999999.99, 'El monto es demasiado grande')
    .optional()
    .nullable(),
  source: z.string().max(255).optional().nullable(),
  categoryId: z.number().int().positive('La categoría es requerida'),
  walletId: z.number().int().positive().optional().nullable(),
  appliesFirstFortnight: z.boolean(),
  appliesSecondFortnight: z.boolean(),
  active: z.boolean(),
  userId: z.number().int().positive().optional().nullable(),
});

export const INCOME_NO_FORTNIGHT_MESSAGE =
  'Elige al menos una quincena: un ingreso programado se crea en la 1ª, en la 2ª o en las dos.';

/** Form schema: a repeating income needs at least one quincena. */
export const incomeTemplateSchema = incomeTemplateFieldsSchema.superRefine((data, ctx) => {
  if (!data.appliesFirstFortnight && !data.appliesSecondFortnight) {
    ctx.addIssue({
      code: 'custom',
      path: ['appliesFirstFortnight'],
      message: INCOME_NO_FORTNIGHT_MESSAGE,
    });
  }
});

export type CreateIncomeTemplateInput = z.infer<
  typeof createIncomeTemplateSchema
>;
export type UpdateIncomeTemplateInput = z.infer<
  typeof updateIncomeTemplateSchema
>;
export type IncomeTemplateFormValues = z.infer<typeof incomeTemplateSchema>;
