import { z } from 'zod';
import {
  nullablePositiveInt,
  nonNegativeAmountSchema,
  positiveAmountSchema,
  requiredStringSchema,
} from '@/schemas/common.schema';
import { PAYMENT_METHODS } from '@/domain/payment-method';
import { WALLET_PROVIDER_ICON_KEYS } from '@/lib/wallet-provider-icons';

// Payment method type enum
export const paymentMethodType = z.enum(PAYMENT_METHODS);
export const creditCardType = z.enum(['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']);
export const walletProviderIconKeySchema = z
  .enum(WALLET_PROVIDER_ICON_KEYS)
  .nullable();

const nullableCreditLimitSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === '' || value === null) return null;
    return Number(value);
  },
  nonNegativeAmountSchema.nullable(),
);

const applyWalletBusinessRules = (
  data: {
    type: (typeof PAYMENT_METHODS)[number];
    cutoff_day: number | null;
    due_day: number | null;
    credit_limit?: number | null;
    temporary_credit_limit?: number | null;
  },
  ctx: z.RefinementCtx,
) => {
  const isCard =
    data.type === 'CREDIT_CARD' || data.type === 'DEPARTMENT_STORE_CARD';

  if (isCard) {
    if (data.credit_limit == null || data.credit_limit <= 0) {
      ctx.addIssue({
        path: ['credit_limit'],
        message: 'La línea de crédito es obligatoria para tarjetas',
        code: z.ZodIssueCode.custom,
      });
    }

    if (!data.cutoff_day) {
      ctx.addIssue({
        path: ['cutoff_day'],
        message: 'El día de corte es obligatorio para tarjetas de crédito',
        code: z.ZodIssueCode.custom,
      });
    }

    if (!data.due_day) {
      ctx.addIssue({
        path: ['due_day'],
        message: 'La fecha de pago es obligatoria para tarjetas de crédito',
        code: z.ZodIssueCode.custom,
      });
    }

    return;
  }

  if (data.temporary_credit_limit != null && data.temporary_credit_limit > 0) {
    ctx.addIssue({
      path: ['temporary_credit_limit'],
      message: 'El límite temporal solo aplica para tarjetas',
      code: z.ZodIssueCode.custom,
    });
  }

  if (data.credit_limit != null) {
    ctx.addIssue({
      path: ['credit_limit'],
      message: 'La línea de crédito solo aplica para tarjetas',
      code: z.ZodIssueCode.custom,
    });
  }

  if (data.cutoff_day != null) {
    ctx.addIssue({
      path: ['cutoff_day'],
      message: 'El día de corte solo aplica para tarjetas',
      code: z.ZodIssueCode.custom,
    });
  }

  if (data.due_day != null) {
    ctx.addIssue({
      path: ['due_day'],
      message: 'El día de pago solo aplica para tarjetas',
      code: z.ZodIssueCode.custom,
    });
  }
};

// Wallet Schemas
export const createWalletSchema = z.object({
  name: requiredStringSchema,
  amount: positiveAmountSchema.default(0),
  credit_limit: nullableCreditLimitSchema.optional(),
  temporary_credit_limit: nullableCreditLimitSchema.optional(),
  type: paymentMethodType,
  provider_icon_key: walletProviderIconKeySchema.optional(),
  active: z.boolean().default(true),
  cutoff_day: nullablePositiveInt,
  due_day: nullablePositiveInt,
  /** Solo en contexto casa: miembro atribuido (null = compartida). */
  assignee_user_id: z.number().int().positive().nullable().optional(),
}).superRefine(applyWalletBusinessRules);

export const updateWalletSchema = z.object({
  name: requiredStringSchema.optional(),
  amount: nonNegativeAmountSchema.optional(),
  credit_limit: nullableCreditLimitSchema.optional(),
  temporary_credit_limit: nullableCreditLimitSchema.optional(),
  type: paymentMethodType.optional(),
  provider_icon_key: walletProviderIconKeySchema.optional(),
  active: z.boolean().optional(),
  cutoff_day: nullablePositiveInt.optional(),
  due_day: nullablePositiveInt.optional(),
  assignee_user_id: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  const type = data.type;
  if (!type) return;

  applyWalletBusinessRules(
    {
      type,
      cutoff_day: data.cutoff_day ?? null,
      due_day: data.due_day ?? null,
      credit_limit: data.credit_limit ?? null,
      temporary_credit_limit: data.temporary_credit_limit ?? null,
    },
    ctx,
  );
});

export const walletSchema = z
  .object({
    name: requiredStringSchema,
    amount: positiveAmountSchema.optional(),
    credit_limit: nullableCreditLimitSchema.default(null),
    temporary_credit_limit: nullableCreditLimitSchema.default(null),
    type: paymentMethodType,
    provider_icon_key: walletProviderIconKeySchema.default(null),
    active: z.boolean().default(true),
    cutoff_day: nullablePositiveInt,
    due_day: nullablePositiveInt,
    assignee_user_id: z.number().int().positive().nullable().optional().default(null),
  })

  .superRefine(applyWalletBusinessRules);

export type WalletFormInput = z.input<typeof walletSchema>;
export type WalletFormValues = z.infer<typeof walletSchema>;
export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
