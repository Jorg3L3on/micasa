import { z } from 'zod';
import {
  createTransactionFieldsSchema,
  withCreditMsiPairRefine,
} from '@/schemas/transaction.schema';
import { creditCardType, createWalletSchema, updateWalletSchema } from '@/schemas/wallet.schema';
import {
  dateStringSchema,
  positiveAmountSchema,
  positiveIntSchema,
} from '@/schemas/common.schema';

export const createCreditCardSchema = createWalletSchema.safeExtend({
  type: creditCardType,
});

export const updateCreditCardSchema = updateWalletSchema.safeExtend({
  type: creditCardType.optional(),
});

export const createCreditCardPurchaseSchema = withCreditMsiPairRefine(
  createTransactionFieldsSchema.omit({
    wallet_id: true,
    card_id: true,
    payment_method_id: true,
    is_paid: true,
  }),
);

export const createCreditCardPaymentSchema = z
  .object({
    source_wallet_id: positiveIntSchema,
    amount: positiveAmountSchema.refine((value) => value > 0, {
      message: 'El monto debe ser mayor a 0',
    }),
    paid_at: dateStringSchema,
    note: z.string().trim().max(200).optional().nullable(),
    /** When true, creates a paid Expense in the fortnight of paid_at (category_id required). */
    create_fortnight_expense: z.boolean().optional(),
    category_id: positiveIntSchema.optional(),
    expense_description: z.string().trim().max(200).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.create_fortnight_expense === true && data.category_id == null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona una categoría para registrar el gasto en la quincena',
        path: ['category_id'],
      });
    }
  });

export const creditCardStatementQuerySchema = z.object({
  asOf: z.string().date().optional(),
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
export type CreateCreditCardPurchaseInput = z.infer<
  typeof createCreditCardPurchaseSchema
>;
export type CreateCreditCardPaymentInput = z.infer<
  typeof createCreditCardPaymentSchema
>;
