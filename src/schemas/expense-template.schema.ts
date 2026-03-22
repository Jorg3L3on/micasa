import { z } from 'zod';
import {
  requiredStringSchema,
  positiveIntSchema,
  maxAmountSchema,
  defaultBooleanSchema,
} from './common.schema';

const optionalDueDayFirstSchema = z
  .number()
  .int()
  .min(1)
  .max(15)
  .optional()
  .nullable();

const optionalDueDaySecondSchema = z
  .number()
  .int()
  .min(16)
  .max(31)
  .optional()
  .nullable();

/** Billing-cycle cutoff on the template; optional — not used when expanding fortnight expenses. */
const optionalCutoffDaySchema = z
  .number()
  .int()
  .min(1)
  .max(31)
  .optional()
  .nullable();

export const refineExpenseTemplateDueDays = (
  data: {
    appliesFirstFortnight: boolean;
    appliesSecondFortnight: boolean;
    dueDayFirst?: number | null;
    dueDaySecond?: number | null;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.appliesFirstFortnight) {
    if (
      data.dueDayFirst != null &&
      (data.dueDayFirst < 1 || data.dueDayFirst > 15)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDayFirst'],
        message:
          'En la 1ª quincena el día de vencimiento debe estar entre 1 y 15',
      });
    }
  } else if (data.dueDayFirst != null) {
    ctx.addIssue({
      code: 'custom',
      path: ['dueDayFirst'],
      message:
        'Marca la 1ª quincena o deja vacío el vencimiento de la 1ª quincena',
    });
  }

  if (data.appliesSecondFortnight) {
    if (
      data.dueDaySecond != null &&
      (data.dueDaySecond < 16 || data.dueDaySecond > 31)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDaySecond'],
        message:
          'En la 2ª quincena el día de vencimiento debe estar entre 16 y 31',
      });
    }
  } else if (data.dueDaySecond != null) {
    ctx.addIssue({
      code: 'custom',
      path: ['dueDaySecond'],
      message:
        'Marca la 2ª quincena o deja vacío el vencimiento de la 2ª quincena',
    });
  }
};

// Expense template schemas
export const createExpenseTemplateSchema = z
  .object({
    name: requiredStringSchema,
    categoryId: positiveIntSchema,
    suggestedAmount: maxAmountSchema.optional(),
    paymentMethodId: positiveIntSchema.optional(),
    active: defaultBooleanSchema,
    expenseIds: z.array(positiveIntSchema).optional().default([]),
    dueDayFirst: optionalDueDayFirstSchema,
    dueDaySecond: optionalDueDaySecondSchema,
    cutoffDay: optionalCutoffDaySchema,
    isRecurring: z.boolean(),
    appliesFirstFortnight: z.boolean(),
    appliesSecondFortnight: z.boolean(),
    isSubscription: z.boolean(),
  })
  .superRefine(refineExpenseTemplateDueDays);

/** PUT replaces the full resource; same shape as create (form always sends all fields). */
export const updateExpenseTemplateSchema = createExpenseTemplateSchema;

export const expenseTemplateSchema = z
  .object({
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
    dueDayFirst: z.union([
      z.number().int().min(1).max(15),
      z.null(),
    ]),
    dueDaySecond: z.union([
      z.number().int().min(16).max(31),
      z.null(),
    ]),
    cutoffDay: z.union([
      z
        .number()
        .int()
        .min(1, 'El día de corte debe estar entre 1 y 31')
        .max(31, 'El día de corte debe estar entre 1 y 31'),
      z.null(),
    ]),
    isRecurring: z.boolean(),
    appliesFirstFortnight: z.boolean(),
    appliesSecondFortnight: z.boolean(),
    isSubscription: z.boolean(),
  })
  .superRefine(refineExpenseTemplateDueDays);

// Type exports
export type CreateExpenseTemplateInput = z.infer<
  typeof createExpenseTemplateSchema
>;
export type UpdateExpenseTemplateInput = z.infer<
  typeof updateExpenseTemplateSchema
>;
export type ExpenseTemplateFormValues = z.infer<typeof expenseTemplateSchema>;
