import { z } from 'zod';
import {
  requiredStringSchema,
  positiveIntSchema,
  maxAmountSchema,
  defaultBooleanSchema,
} from './common.schema';

/**
 * Day 15 belongs to the 2ª quincena (MIC-I16): the 1ª takes days 1-14 and the
 * 2ª days 15-30. A due day is looked up inside its quincena, so 15 in the 1ª
 * or 31 in the 2ª would never match a date.
 */
export const DUE_DAY_FIRST_MIN = 1;
export const DUE_DAY_FIRST_MAX = 14;
export const DUE_DAY_SECOND_MIN = 15;
export const DUE_DAY_SECOND_MAX = 30;

const DUE_DAY_FIRST_MESSAGE = `En la 1ª quincena el día de vencimiento debe estar entre ${DUE_DAY_FIRST_MIN} y ${DUE_DAY_FIRST_MAX}`;
const DUE_DAY_SECOND_MESSAGE = `En la 2ª quincena el día de vencimiento debe estar entre ${DUE_DAY_SECOND_MIN} y ${DUE_DAY_SECOND_MAX}`;

export const dueDayFirstSchema = z
  .number()
  .int()
  .min(DUE_DAY_FIRST_MIN, DUE_DAY_FIRST_MESSAGE)
  .max(DUE_DAY_FIRST_MAX, DUE_DAY_FIRST_MESSAGE);

export const dueDaySecondSchema = z
  .number()
  .int()
  .min(DUE_DAY_SECOND_MIN, DUE_DAY_SECOND_MESSAGE)
  .max(DUE_DAY_SECOND_MAX, DUE_DAY_SECOND_MESSAGE);

const optionalDueDayFirstSchema = dueDayFirstSchema.optional().nullable();

const optionalDueDaySecondSchema = dueDaySecondSchema.optional().nullable();

/**
 * Billing-cycle cutoff on the template; optional, not used when expanding
 * fortnight expenses. The form no longer sends it (Corte is read from the
 * card); an update without it keeps the stored value.
 */
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
      (data.dueDayFirst < DUE_DAY_FIRST_MIN || data.dueDayFirst > DUE_DAY_FIRST_MAX)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDayFirst'],
        message: DUE_DAY_FIRST_MESSAGE,
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
      (data.dueDaySecond < DUE_DAY_SECOND_MIN || data.dueDaySecond > DUE_DAY_SECOND_MAX)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['dueDaySecond'],
        message: DUE_DAY_SECOND_MESSAGE,
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
    /** Null clears it: the item then has a variable amount. */
    suggestedAmount: maxAmountSchema.optional().nullable(),
    paymentMethodId: positiveIntSchema.optional().nullable(),
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

/**
 * PATCH changes `active` only. The detail overlay's Activo toggle uses it so
 * it never rewrites the other fields (PUT replaces the whole resource and
 * would drop a legacy `due_day`).
 */
export const setExpenseTemplateActiveSchema = z.object({ active: z.boolean() }).strict();

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
    dueDayFirst: z.union([dueDayFirstSchema, z.null()]),
    dueDaySecond: z.union([dueDaySecondSchema, z.null()]),
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
export type SetExpenseTemplateActiveInput = z.infer<
  typeof setExpenseTemplateActiveSchema
>;
export type UpdateExpenseTemplateInput = z.infer<
  typeof updateExpenseTemplateSchema
>;
export type ExpenseTemplateFormValues = z.infer<typeof expenseTemplateSchema>;
