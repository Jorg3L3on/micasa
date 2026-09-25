import { z } from 'zod';
import { dateStringSchema } from './common.schema';

const nullablePositiveIntFromForm = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return null;
    return Number(value);
  },
  z.number().int().positive().nullable(),
);

export const createLenderSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del prestamista es obligatorio'),
  providerIconKey: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const payLenderSchema = z
  .object({
    mode: z.enum(['WALLET', 'EXTERNAL']).default('WALLET'),
    paidAt: dateStringSchema.optional(),
    sourceWalletId: nullablePositiveIntFromForm.optional(),
    note: z.string().trim().max(500).optional().nullable(),
    excludePaymentIds: z.array(z.number().int().positive()).optional(),
    amount: z.preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') return null;
        return Number(value);
      },
      z.number().positive('El monto del pago debe ser mayor a 0').nullable(),
    ).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'WALLET' && !data.sourceWalletId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceWalletId'],
        message: 'Selecciona la billetera que paga al prestamista',
      });
    }
  });

export const mergeLenderSchema = z.object({
  targetLenderId: z.number().int().positive(),
});

export const splitLenderSchema = z
  .object({
    loanIds: z.array(z.number().int().positive()).min(1),
    targetLenderId: nullablePositiveIntFromForm.optional(),
    name: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.targetLenderId && !data.name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Elige un prestamista o escribe un nombre',
      });
    }
  });

export type CreateLenderInput = z.infer<typeof createLenderSchema>;
export type PayLenderInput = z.infer<typeof payLenderSchema>;
export type MergeLenderInput = z.infer<typeof mergeLenderSchema>;
export type SplitLenderInput = z.infer<typeof splitLenderSchema>;
