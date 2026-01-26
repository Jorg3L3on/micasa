import { z } from 'zod';
import { requiredStringSchema, optionalStringSchema } from './common.schema';

// Category schemas
export const createCategorySchema = z.object({
  name: requiredStringSchema,
  description: optionalStringSchema,
});

export const updateCategorySchema = z.object({
  name: requiredStringSchema.optional(),
  description: optionalStringSchema,
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  description: z.string().optional(),
});

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
