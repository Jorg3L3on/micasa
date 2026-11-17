import { z } from 'zod';
import { positiveIntSchema, positiveAmountSchema, requiredStringSchema } from '@/schemas/common.schema';

export const BUDGET_FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'CUSTOM'] as const;
export type BudgetFrequency = (typeof BUDGET_FREQUENCIES)[number];

export const budgetFrequencyEnum = z.enum(BUDGET_FREQUENCIES);

export const BUDGET_FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  CUSTOM: 'Personalizado',
};

/** Sentinel for the billetera select. Stored as `wallet_id` null. */
export const ANY_WALLET_SELECT_VALUE = 'any';

/** Shown when an allocation matches every wallet. */
export const ANY_WALLET_LABEL = 'Cualquier billetera';

export const allocationWalletIdSchema = z.union([positiveIntSchema, z.null()]).optional();

export function walletIdToSelectValue(walletId: number | null | undefined): string {
  if (walletId === null) return ANY_WALLET_SELECT_VALUE;
  if (typeof walletId === 'number' && walletId > 0) return String(walletId);
  return '';
}

export function selectValueToWalletId(value: string): number | null {
  if (value === ANY_WALLET_SELECT_VALUE) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Unset (0 / empty) still needs a choice. Null is Cualquier billetera. */
export function isWalletSelectionMissing(walletId: number | null | undefined): boolean {
  return walletId !== null && !(typeof walletId === 'number' && walletId > 0);
}

export const allocationSchema = z.object({
  wallet_id: allocationWalletIdSchema,
  category_id: positiveIntSchema,
  amount: positiveAmountSchema.refine(
    (amount) => amount > 0,
    'El monto de cada asignación debe ser mayor a 0',
  ),
});

export const step1Schema = z.object({
  name: requiredStringSchema.max(25, 'El nombre no puede tener más de 25 caracteres'),
  allocated_amount: positiveAmountSchema,
  frequency: budgetFrequencyEnum,
  recurrent: z.boolean().default(true),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.frequency === 'CUSTOM') {
    if (!data.start_date) {
      ctx.addIssue({ path: ['start_date'], message: 'Fecha de inicio requerida', code: z.ZodIssueCode.custom });
    }
    if (!data.end_date) {
      ctx.addIssue({ path: ['end_date'], message: 'Fecha de fin requerida', code: z.ZodIssueCode.custom });
    }
    if (data.start_date && data.end_date && data.start_date >= data.end_date) {
      ctx.addIssue({ path: ['end_date'], message: 'La fecha de fin debe ser posterior a la de inicio', code: z.ZodIssueCode.custom });
    }
  }
});

export const step2Schema = z.object({
  allocations: z.array(allocationSchema).min(1, 'Debes agregar al menos una asignación'),
});

export const createBudgetSchema = z.object({
  name: requiredStringSchema.max(25, 'El nombre no puede tener más de 25 caracteres'),
  allocated_amount: positiveAmountSchema,
  frequency: budgetFrequencyEnum,
  recurrent: z.boolean().default(true),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  allocations: z.array(allocationSchema).min(1, 'Debes agregar al menos una asignación'),
}).superRefine((data, ctx) => {
  if (data.frequency === 'CUSTOM') {
    if (!data.start_date) {
      ctx.addIssue({ path: ['start_date'], message: 'Fecha de inicio requerida', code: z.ZodIssueCode.custom });
    }
    if (!data.end_date) {
      ctx.addIssue({ path: ['end_date'], message: 'Fecha de fin requerida', code: z.ZodIssueCode.custom });
    }
  }
  const allocTotal = data.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  if (Math.abs(allocTotal - Number(data.allocated_amount)) > 0.01) {
    ctx.addIssue({
      path: ['allocations'],
      message: 'La suma de asignaciones debe ser igual al presupuesto total',
      code: z.ZodIssueCode.custom,
    });
  }
});

export const updateBudgetAllocationsSchema = z.object({
  allocations: z.array(allocationSchema).min(1, 'Debes agregar al menos una asignación'),
});

/** Template fields; `allocations`, when sent, replace the stored ones in the same update. */
export const updateBudgetSchema = step1Schema.and(
  z.object({
    allocations: z.array(allocationSchema).min(1, 'Debes agregar al menos una asignación').optional(),
  }),
);

export const setBudgetActiveSchema = z.object({
  active: z.boolean(),
  effective_date: z.string().optional().nullable(),
});

/** One quincena of a budget: its year, month and FIRST / SECOND half. */
export const budgetQuincenaRefSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  period: z.enum(['FIRST', 'SECOND']),
});

/**
 * One-quincena adjustment (MIC-I19). PAUSE sets the quincena to $0; AMOUNTS
 * takes a total that is split across the categories in the template's
 * proportions.
 */
export const budgetFortnightAdjustmentSchema = budgetQuincenaRefSchema
  .extend({
    kind: z.enum(['PAUSE', 'AMOUNTS']),
    total: z.coerce
      .number()
      .min(0, 'El monto no puede ser negativo')
      .max(99_999_999.99)
      .optional(),
    note: z.string().trim().max(120).optional().nullable(),
  })
  .refine((value) => value.kind === 'PAUSE' || value.total != null, {
    message: 'Indica el monto para esta quincena',
    path: ['total'],
  });

export type BudgetQuincenaRef = z.infer<typeof budgetQuincenaRefSchema>;
export type BudgetFortnightAdjustmentInput = z.infer<typeof budgetFortnightAdjustmentSchema>;
export type AllocationInput = z.infer<typeof allocationSchema>;
export type AllocationInputRaw = z.input<typeof allocationSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type Step1Values = z.infer<typeof step1Schema>;
export type Step1Input = z.input<typeof step1Schema>;
export type Step2Values = z.infer<typeof step2Schema>;
export type Step2Input = z.input<typeof step2Schema>;
export type UpdateBudgetAllocationsInput = z.infer<typeof updateBudgetAllocationsSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type SetBudgetActiveInput = z.infer<typeof setBudgetActiveSchema>;
