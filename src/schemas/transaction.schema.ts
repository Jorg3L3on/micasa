import { z } from 'zod';
import {
  requiredStringSchema,
  positiveIntSchema,
  positiveAmountSchema,
  dateStringSchema,
  optionalBooleanSchema,
  defaultBooleanSchema,
} from './common.schema';

// Transaction schemas (wallet_id = Wallet model; card_id/payment_method_id kept for backward compat)
export const createTransactionFieldsSchema = z.object({
  fortnight_id: positiveIntSchema,
  wallet_id: positiveIntSchema.nullable().optional(),
  card_id: positiveIntSchema.nullable().optional(),
  payment_method_id: positiveIntSchema.optional(),
  category_id: positiveIntSchema,
  description: z.string().min(1, 'Description is required'),
  amount: positiveAmountSchema,
  is_paid: defaultBooleanSchema,
  payment_date: dateStringSchema.nullable().optional(),
  expense_template_id: positiveIntSchema.optional(),
  credit_msi_current: z.number().int().positive().optional().nullable(),
  credit_msi_total: z.number().int().positive().optional().nullable(),
});

export const withCreditMsiPairRefine = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine((d: unknown) => {
    const o = d as {
      credit_msi_current?: number | null;
      credit_msi_total?: number | null;
    };
    const c = o.credit_msi_current;
    const t = o.credit_msi_total;
    if (c == null && t == null) return true;
    if (c == null || t == null) return false;
    return c <= t;
  }, {
    message: 'MSI: indica cuota actual y total (actual ≤ total)',
    path: ['credit_msi_current'],
  });

export const createTransactionSchema = withCreditMsiPairRefine(
  createTransactionFieldsSchema,
);

export const updateTransactionSchema = z.object({
  fortnight_id: positiveIntSchema.optional(),
  wallet_id: positiveIntSchema.nullable().optional(),
  card_id: positiveIntSchema.nullable().optional(),
  category_id: positiveIntSchema.optional(),
  description: z.string().min(1).optional(),
  amount: positiveAmountSchema.optional(),
  is_paid: optionalBooleanSchema,
  payment_date: dateStringSchema.nullable().optional(),
});

export const updatePaidSchema = z.object({
  paid: z.boolean(),
});

export const addExpenseSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    categoryId: z.number().int().positive('La categoría es requerida'),
    amount: z.number().positive('El monto debe ser mayor a 0'),
    paymentMethodId: z
      .number()
      .int()
      .positive('El método de pago es requerido'),
    date: z.string().min(1, 'La fecha es requerida'),
    isPaid: z.boolean(),
    isRecurring: z.boolean(),
    applyToBothFortnights: z.boolean(),
    expenseTemplateId: z.number().int().positive().optional().nullable(),
  })
  .refine(
    (data) => {
      // "Aplicar a ambas quincenas" can only be true if "Es recurrente" is true
      if (data.applyToBothFortnights && !data.isRecurring) {
        return false;
      }
      return true;
    },
    {
      message: 'Debe marcar "Es recurrente" para aplicar a ambas quincenas',
      path: ['applyToBothFortnights'],
    },
  );

// Type exports
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpdatePaidInput = z.infer<typeof updatePaidSchema>;
export type AddExpenseFormValues = z.infer<typeof addExpenseSchema>;
