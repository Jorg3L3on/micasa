import { z } from 'zod';
import {
  createTransactionFieldsSchema,
  withCreditInstallmentPairRefine,
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

export const createCreditCardPurchaseSchema = withCreditInstallmentPairRefine(
  createTransactionFieldsSchema.omit({
    wallet_id: true,
    card_id: true,
    payment_method_id: true,
    is_paid: true,
  }),
);

const paymentAmountSchema = positiveAmountSchema.refine((value) => value > 0, {
  message: 'El monto debe ser mayor a 0',
});

const walletPaymentFields = z.object({
  source_wallet_id: positiveIntSchema,
  create_fortnight_expense: z.boolean().optional(),
  fortnight_id: positiveIntSchema.optional(),
  category_id: positiveIntSchema.optional(),
  expense_description: z.string().trim().max(200).optional().nullable(),
});

export const createCreditCardPaymentSchema = z
  .discriminatedUnion('mode', [
    z
      .object({
        mode: z.literal('wallet'),
        amount: paymentAmountSchema,
        paid_at: dateStringSchema,
        note: z.string().trim().max(200).optional().nullable(),
      })
      .merge(walletPaymentFields)
      .superRefine((data, ctx) => {
        if (data.create_fortnight_expense === true && data.category_id == null) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Selecciona una categoría para registrar el gasto en la quincena',
            path: ['category_id'],
          });
        }
      }),
    z.object({
      mode: z.literal('external'),
      amount: paymentAmountSchema,
      paid_at: dateStringSchema,
      note: z.string().trim().max(200).optional().nullable(),
      /** When false, only records the payment without reducing card debt. */
      adjusts_debt: z.boolean().optional(),
    }),
  ])
  .or(
    z
      .object({
        source_wallet_id: positiveIntSchema,
        amount: paymentAmountSchema,
        paid_at: dateStringSchema,
        note: z.string().trim().max(200).optional().nullable(),
        create_fortnight_expense: z.boolean().optional(),
        fortnight_id: positiveIntSchema.optional(),
        category_id: positiveIntSchema.optional(),
        expense_description: z.string().trim().max(200).optional().nullable(),
      })
      .superRefine((data, ctx) => {
        if (data.create_fortnight_expense === true && data.category_id == null) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Selecciona una categoría para registrar el gasto en la quincena',
            path: ['category_id'],
          });
        }
      }),
  );

export const normalizeCreditCardPaymentInput = (
  input: z.infer<typeof createCreditCardPaymentSchema>,
) => {
  if ('mode' in input) {
    if (input.mode === 'external') {
      return {
        mode: 'external' as const,
        amount: input.amount,
        paid_at: input.paid_at,
        note: input.note ?? null,
        adjusts_debt: input.adjusts_debt ?? true,
      };
    }
    return {
      mode: 'wallet' as const,
      amount: input.amount,
      paid_at: input.paid_at,
      note: input.note ?? null,
      source_wallet_id: input.source_wallet_id,
      create_fortnight_expense: input.create_fortnight_expense,
      fortnight_id: input.fortnight_id,
      category_id: input.category_id,
      expense_description: input.expense_description ?? null,
    };
  }

  return {
    mode: 'wallet' as const,
    amount: input.amount,
    paid_at: input.paid_at,
    note: input.note ?? null,
    source_wallet_id: input.source_wallet_id,
    create_fortnight_expense: input.create_fortnight_expense,
    fortnight_id: input.fortnight_id,
    category_id: input.category_id,
    expense_description: input.expense_description ?? null,
  };
};

export type NormalizedCreditCardPaymentInput = ReturnType<
  typeof normalizeCreditCardPaymentInput
>;

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
