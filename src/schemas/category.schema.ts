import { z } from 'zod';
import { requiredStringSchema, optionalStringSchema } from './common.schema';

// Category schemas
export const createCategorySchema = z.object({
  name: requiredStringSchema,
  description: optionalStringSchema,
  icon: optionalStringSchema,
});

export const updateCategorySchema = z.object({
  name: requiredStringSchema.optional(),
  description: optionalStringSchema,
  icon: optionalStringSchema,
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  description: z.string().optional(),
  icon: z.string().max(16, 'Usa un ícono corto').optional(),
});

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
