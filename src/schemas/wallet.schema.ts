import { z } from 'zod';
import {
  nullablePositiveInt,
  positiveAmountSchema,
  requiredStringSchema,
} from '@/schemas/common.schema';
import { PAYMENT_METHODS } from '@/domain/payment-method';

// Payment method type enum
export const paymentMethodType = z.enum(PAYMENT_METHODS);

// Wallet Schemas
export const createWalletSchema = z.object({
  name: requiredStringSchema,
  amount: positiveAmountSchema.default(0),
  type: paymentMethodType,
  active: z.boolean().default(true),
  cutoff_day: nullablePositiveInt,
  due_day: nullablePositiveInt,
});

export const updateWalletSchema = z.object({
  name: requiredStringSchema.optional(),
  amount: positiveAmountSchema.optional(),
  type: paymentMethodType.optional(),
  active: z.boolean().optional(),
  cutoff_day: nullablePositiveInt.optional(),
  due_day: nullablePositiveInt.optional(),
});

export const walletSchema = z
  .object({
    name: requiredStringSchema,
    amount: positiveAmountSchema.optional(),
    type: paymentMethodType,
    active: z.boolean().default(true),
    cutoff_day: nullablePositiveInt,
    due_day: nullablePositiveInt,
  })

  .superRefine((data, ctx) => {
    if (data.type === 'CREDIT_CARD' || data.type === 'DEPARTMENT_STORE_CARD') {
      // cutoff_day requerida
      if (!data.cutoff_day) {
        ctx.addIssue({
          path: ['cutoff_day'],
          message: 'El día de corte es obligatorio para tarjetas de crédito',
          code: z.ZodIssueCode.custom,
        });
      }

      // due_day requerida
      if (!data.due_day) {
        ctx.addIssue({
          path: ['due_day'],
          message: 'La fecha de pago es obligatoria para tarjetas de crédito',
          code: z.ZodIssueCode.custom,
        });
      }
    }
  });

export type WalletFormInput = z.input<typeof walletSchema>;
export type WalletFormValues = z.infer<typeof walletSchema>;
export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
