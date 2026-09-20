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

export type CreateLenderInput = z.infer<typeof createLenderSchema>;
export type PayLenderInput = z.infer<typeof payLenderSchema>;
