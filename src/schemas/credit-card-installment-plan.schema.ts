import { z } from 'zod';
import { dateStringSchema, positiveAmountSchema } from '@/schemas/common.schema';

export const createCreditCardInstallmentPlanSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
    installment_amount: positiveAmountSchema.refine((value) => value > 0, {
      message: 'El monto de cuota debe ser mayor a 0',
    }),
    total_installments: z
      .number()
      .int('Debe ser un entero')
      .min(2, 'Mínimo 2 meses')
      .max(60, 'Máximo 60 meses'),
    paid_installments: z
      .number()
      .int('Debe ser un entero')
      .min(0, 'No puede ser negativo')
      .default(0),
    next_due_date: dateStringSchema.optional(),
    already_in_card_balance: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.paid_installments >= data.total_installments) {
      ctx.addIssue({
        code: 'custom',
        message: 'Las cuotas pagadas deben ser menores al total',
        path: ['paid_installments'],
      });
    }
  });

export type CreateCreditCardInstallmentPlanInput = z.infer<
  typeof createCreditCardInstallmentPlanSchema
>;

export const updateCreditCardInstallmentPlanSchema =
  createCreditCardInstallmentPlanSchema;

export type UpdateCreditCardInstallmentPlanInput = z.infer<
  typeof updateCreditCardInstallmentPlanSchema
>;
