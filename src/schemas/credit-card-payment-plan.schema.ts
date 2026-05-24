import { z } from 'zod';

export const cardPaymentPlanSchema = z.object({
  walletId: z.number().int().positive(),
  plannedAmount: z.number().min(0),
});

export const cardPaymentPlanFormSchema = z.object({
  plannedAmount: z.coerce.number().min(0),
});

export type CardPaymentPlanInput = z.infer<typeof cardPaymentPlanSchema>;
export type CardPaymentPlanFormValues = z.infer<typeof cardPaymentPlanFormSchema>;
