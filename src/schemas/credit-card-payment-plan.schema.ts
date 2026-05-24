import { z } from 'zod';

export const cardPaymentPlanSchema = z.object({
  walletId: z.number().int().positive(),
  plannedAmount: z.number().min(0),
});

export const cardPaymentPlanFormSchema = z.object({
  plannedAmount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
});

export type CardPaymentPlanInput = z.infer<typeof cardPaymentPlanSchema>;
export type CardPaymentPlanFormValues = z.infer<typeof cardPaymentPlanFormSchema>;
