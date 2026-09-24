import { z } from 'zod';

export const cardPaymentPlanScopeSchema = z.enum([
  'this_cycle',
  'n_cycles',
  'until_date',
]);

const scopeFields = {
  scope: cardPaymentPlanScopeSchema.optional(),
  cycleCount: z.number().int().min(1).max(36).optional(),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
};

const refineScope = (
  data: {
    scope?: 'this_cycle' | 'n_cycles' | 'until_date';
    cycleCount?: number;
    validUntil?: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.scope === 'n_cycles' && (data.cycleCount == null || data.cycleCount < 1)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Indica cuántos cortes cubre el pago.',
      path: ['cycleCount'],
    });
  }
  if (data.scope === 'until_date' && !data.validUntil) {
    ctx.addIssue({
      code: 'custom',
      message: 'Indica la fecha hasta la que aplica el pago.',
      path: ['validUntil'],
    });
  }
};

export const cardPaymentPlanSchema = z
  .object({
    walletId: z.number().int().positive(),
    plannedAmount: z.number().positive().optional(),
    declareZero: z.boolean().optional(),
    ...scopeFields,
  })
  .superRefine((data, ctx) => {
    if (
      data.declareZero !== true &&
      (data.plannedAmount == null || data.plannedAmount <= 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'El monto planeado debe ser mayor a 0, o declara que este ciclo es $0.',
        path: ['plannedAmount'],
      });
    }
    refineScope(data, ctx);
  });

export const cardPaymentPlanFormSchema = z
  .object({
    plannedAmount: z
      .number()
      .positive(
        'El monto debe ser mayor a 0. Quita el monto planeado si no quieres un override.',
      ),
    scope: cardPaymentPlanScopeSchema,
    cycleCount: z.number().int().min(1).max(36).optional(),
    validUntil: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    refineScope(
      {
        ...data,
        validUntil: data.validUntil || undefined,
      },
      ctx,
    );
  });

export type CardPaymentPlanInput = z.infer<typeof cardPaymentPlanSchema>;
export type CardPaymentPlanFormValues = z.infer<typeof cardPaymentPlanFormSchema>;
