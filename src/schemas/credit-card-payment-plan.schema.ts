import { z } from 'zod';

export const cardPaymentPlanSchema = z
  .object({
    walletId: z.number().int().positive(),
    plannedAmount: z.number().positive().optional(),
    declareZero: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.declareZero === true ||
      (data.plannedAmount != null && data.plannedAmount > 0),
    {
      message:
        'El monto planeado debe ser mayor a 0, o declara que este ciclo es $0.',
    },
  );

export const cardPaymentPlanFormSchema = z.object({
  plannedAmount: z
    .number()
    .positive(
      'El monto debe ser mayor a 0. Quita el monto planeado si no quieres un override.',
    ),
});

export type CardPaymentPlanInput = z.infer<typeof cardPaymentPlanSchema>;
export type CardPaymentPlanFormValues = z.infer<typeof cardPaymentPlanFormSchema>;
