import { z } from 'zod';
import { requiredStringSchema } from './common.schema';

// Payment method type enum
export const paymentMethodTypeSchema = z.enum(['CARD', 'CASH']);

// Payment method schemas
export const createPaymentMethodSchema = z.object({
  name: requiredStringSchema,
  type: paymentMethodTypeSchema,
});

export const updatePaymentMethodSchema = z.object({
  name: requiredStringSchema.optional(),
  type: paymentMethodTypeSchema.optional(),
});

export const paymentMethodSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  type: paymentMethodTypeSchema.nullable(),
});

// Type exports
export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;
