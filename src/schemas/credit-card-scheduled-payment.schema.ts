import { z } from 'zod';
import { dateStringSchema, positiveAmountSchema } from '@/schemas/common.schema';

export const createCreditCardScheduledPaymentSchema = z.object({
  due_date: dateStringSchema,
  amount: positiveAmountSchema.refine((value) => value > 0, {
    message: 'El monto debe ser mayor a 0',
  }),
  label: z.string().trim().max(120).optional().nullable(),
});

export const updateCreditCardScheduledPaymentSchema = z.object({
  due_date: dateStringSchema.optional(),
  amount: positiveAmountSchema
    .refine((value) => value > 0, {
      message: 'El monto debe ser mayor a 0',
    })
    .optional(),
  label: z.string().trim().max(120).optional().nullable(),
});

export type CreateCreditCardScheduledPaymentInput = z.infer<
  typeof createCreditCardScheduledPaymentSchema
>;
export type UpdateCreditCardScheduledPaymentInput = z.infer<
  typeof updateCreditCardScheduledPaymentSchema
>;
