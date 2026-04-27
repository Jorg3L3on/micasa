import { z } from 'zod';

export const taskStatusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELED',
]);
export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const recurrenceUnitSchema = z.enum(['DAY', 'WEEK', 'MONTH']);

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

export const recurrenceSchema = z
  .object({
    unit: recurrenceUnitSchema,
    every: z.number().int().min(1).max(365),
    anchor: z.string().datetime().optional().nullable(),
  })
  .optional()
  .nullable();

export const createTaskItemSchema = z.object({
  list_id: z.number().int().positive(),
  title: z.string().min(1, 'El título es obligatorio').max(180),
  notes: optionalTrimmedString,
  priority: taskPrioritySchema.optional(),
  due_at: z.string().datetime().optional().nullable(),
  recurrence: recurrenceSchema,
});

export type CreateTaskItemInput = z.infer<typeof createTaskItemSchema>;

export const updateTaskItemSchema = z
  .object({
    title: z.string().min(1).max(180).optional(),
    notes: optionalTrimmedString,
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    due_at: z.string().datetime().optional().nullable(),
    recurrence: recurrenceSchema,
    sort_order: z.number().int().min(0).max(100_000).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'No hay cambios',
  });

export type UpdateTaskItemInput = z.infer<typeof updateTaskItemSchema>;
