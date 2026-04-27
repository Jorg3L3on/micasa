import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const createTaskListSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  description: optionalTrimmedString,
  color: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{3,8}$/, 'Color inválido')
    .optional()
    .nullable(),
});

export type CreateTaskListInput = z.infer<typeof createTaskListSchema>;

export const updateTaskListSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: optionalTrimmedString,
    color: z
      .string()
      .trim()
      .regex(/^#?[0-9a-fA-F]{3,8}$/, 'Color inválido')
      .optional()
      .nullable(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.color !== undefined ||
      value.archived !== undefined,
    'No hay cambios',
  );

export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>;
