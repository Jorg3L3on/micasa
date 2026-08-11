import { z } from 'zod';
import {
  dateStringSchema,
  nonNegativeAmountSchema,
  positiveIntSchema,
} from '@/schemas/common.schema';

export const createWalletTransferSchema = z
  .object({
    from_wallet_id: positiveIntSchema,
    to_wallet_id: positiveIntSchema,
    amount: z.number().positive('El monto debe ser mayor a 0'),
    fee_amount: nonNegativeAmountSchema.optional().default(0),
    note: z.string().trim().max(500).optional().nullable(),
    transferred_at: dateStringSchema,
    exclude_from_report: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.from_wallet_id === data.to_wallet_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to_wallet_id'],
        message: 'Origen y destino deben ser distintas',
      });
    }
  });

export type CreateWalletTransferInput = z.infer<typeof createWalletTransferSchema>;
