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

export const allocationSchema = z.object({
  wallet_id: positiveIntSchema,
  category_id: positiveIntSchema,
  amount: positiveAmountSchema,
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
  if (allocTotal > Number(data.allocated_amount)) {
    ctx.addIssue({
      path: ['allocations'],
      message: 'La suma de asignaciones supera el presupuesto total',
      code: z.ZodIssueCode.custom,
    });
  }
});

export const updateBudgetAllocationsSchema = z.object({
  allocations: z.array(allocationSchema).min(1, 'Debes agregar al menos una asignación'),
});

export const updateBudgetSchema = step1Schema;

export const setBudgetActiveSchema = z.object({
  active: z.boolean(),
});

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
