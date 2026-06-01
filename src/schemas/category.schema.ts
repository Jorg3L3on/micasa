import { z } from 'zod';
import { validateCategoryIconInput } from '@/lib/category-icons';
import { requiredStringSchema, optionalStringSchema } from './common.schema';

const categoryIconSchema = (existingIcon: string | null = null) =>
  z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const result = validateCategoryIconInput(value, existingIcon);
      if (!result.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message,
        });
      }
    });

// Category schemas
export const createCategorySchema = z.object({
  name: requiredStringSchema,
  description: optionalStringSchema,
  icon: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      const result = validateCategoryIconInput(value, null);
      if (!result.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.message,
        });
      }
    }),
});

export const updateCategorySchema = z.object({
  name: requiredStringSchema.optional(),
  description: optionalStringSchema,
  icon: z.string().optional(),
});

export const createCategoryFormSchema = (existingIcon: string | null = null) =>
  z.object({
    name: z.string().min(1, 'Nombre es requerido'),
    description: z.string().optional(),
    icon: categoryIconSchema(existingIcon),
  });

export const categorySchema = createCategoryFormSchema();

// Type exports
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryFormValues = z.infer<typeof categorySchema>;
