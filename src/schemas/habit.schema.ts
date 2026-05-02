import { z } from 'zod';
import { recurrenceUnitSchema } from '@/schemas/task-item.schema';

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const reminderTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:mm)')
  .nullable()
  .optional();

export const createHabitSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  description: optionalTrimmedString,
  recurrence_unit: recurrenceUnitSchema,
  recurrence_every: z.number().int().min(1).max(365).optional(),
  target_per_period: z.number().int().min(1).max(365).optional(),
  reminder_time: reminderTimeSchema,
  /** Contexto casa: id de miembro. Contexto usuario: omitir. */
  assignee_user_id: z.number().int().positive().optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: optionalTrimmedString,
    active: z.boolean().optional(),
    recurrence_unit: recurrenceUnitSchema.optional(),
    recurrence_every: z.number().int().min(1).max(365).optional(),
    target_per_period: z.number().int().min(1).max(365).optional(),
    reminder_time: reminderTimeSchema,
    assignee_user_id: z.number().int().positive().optional().nullable(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'No hay cambios',
  });

export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

export const completeHabitSchema = z.object({
  completed_on: z.string().datetime().optional(),
  note: optionalTrimmedString,
});

export type CompleteHabitInput = z.infer<typeof completeHabitSchema>;
