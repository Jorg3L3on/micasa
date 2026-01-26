import { z } from 'zod';
import {
  requiredStringSchema,
  daySchema,
  monthSchema,
  yearSchema,
  optionalBooleanSchema,
  defaultBooleanSchema,
} from './common.schema';

// Fortnight period enum
export const fortnightPeriodSchema = z.enum(['FIRST', 'SECOND'], {
  message: 'Período es requerido',
});

// Fortnight schemas
export const createFortnightSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(255, 'El nombre debe tener menos de 255 caracteres'),
  startDay: daySchema,
  endDay: daySchema,
  active: defaultBooleanSchema,
  year: yearSchema,
  month: monthSchema,
  period: fortnightPeriodSchema,
});

export const updateFortnightSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').optional(),
  startDay: daySchema.optional(),
  endDay: daySchema.optional(),
  active: optionalBooleanSchema,
  year: yearSchema.optional(),
  month: monthSchema.optional(),
  period: fortnightPeriodSchema.optional(),
});

export const fortnightSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(255, 'El nombre debe tener menos de 255 caracteres'),
  startDay: z
    .number()
    .int()
    .min(1, 'El día de inicio debe estar entre 1 y 31')
    .max(31, 'El día de inicio debe estar entre 1 y 31'),
  endDay: z
    .number()
    .int()
    .min(1, 'El día de fin debe estar entre 1 y 31')
    .max(31, 'El día de fin debe estar entre 1 y 31'),
  active: z.boolean(),
  month: monthSchema,
  year: yearSchema,
  period: fortnightPeriodSchema,
});

export const overrideAmountSchema = z.object({
  amount: z.number().min(0, 'Amount must be greater than or equal to 0'),
  year: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
});

// Type exports
export type CreateFortnightInput = z.infer<typeof createFortnightSchema>;
export type UpdateFortnightInput = z.infer<typeof updateFortnightSchema>;
export type FortnightFormValues = z.infer<typeof fortnightSchema>;
export type OverrideAmountInput = z.infer<typeof overrideAmountSchema>;
export type OverrideAmountFormValues = z.infer<typeof overrideAmountSchema>;
