import { z } from 'zod';

// Common ID validators
export const positiveIntSchema = z.number().int().positive();
export const nullablePositiveInt = z.preprocess(
  (value) => {
    if (value === undefined || value === '' || value === null) return null
    return value
  },
  positiveIntSchema.nullable()
);

// Common date validators
export const dateStringSchema = z.string().datetime();

// Common money/amount validators
//export const positiveAmountSchema = z.number().positive('Amount must be greater than 0');
export const nonNegativeAmountSchema = z.number().min(0, 'Amount must be greater than or equal to 0');
export const maxAmountSchema = z.number().positive().max(99999999.99);
export const positiveAmountSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return 0
    return Number(value)
  },
  z.number().min(0, 'El monto debe ser mayor o igual a 0')
)


// Common day validators (1-31)
export const daySchema = z.number().int().min(1).max(31, 'Day must be between 1 and 31');

// Common month validators (1-12)
export const monthSchema = z.number().int().min(1).max(12, 'Month must be between 1 and 12');

// Common year validators
export const yearSchema = z.number().int().min(2020).max(2030, 'Year must be between 2020 and 2030');

// Common name/string validators
export const requiredStringSchema = z.string().min(1, 'Name is required');
export const optionalStringSchema = z.string().optional();

// Common boolean validators
export const booleanSchema = z.boolean();
export const optionalBooleanSchema = z.boolean().optional();
export const defaultBooleanSchema = z.boolean().optional().default(true);
