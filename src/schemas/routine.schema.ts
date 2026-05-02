import { z } from 'zod';

export const routineTimeOfDaySchema = z.enum([
  'MORNING',
  'AFTERNOON',
  'NIGHT',
  'CUSTOM',
]);

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .optional();

const routineStepSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio').max(140),
  description: optionalTrimmedString,
  is_optional: z.boolean().optional(),
});

export const createRoutineSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(120),
  description: optionalTrimmedString,
  time_of_day: routineTimeOfDaySchema.optional(),
  active_days: z.array(z.number().int().min(0).max(6)).optional(),
  steps: z.array(routineStepSchema).min(1, 'Agrega al menos un paso'),
  assignee_user_id: z.number().int().positive().optional(),
});

export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;

export const updateRoutineSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: optionalTrimmedString,
    time_of_day: routineTimeOfDaySchema.optional(),
    active_days: z.array(z.number().int().min(0).max(6)).optional(),
    active: z.boolean().optional(),
    steps: z.array(routineStepSchema).min(1).optional(),
    assignee_user_id: z.number().int().positive().optional().nullable(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'No hay cambios',
  });

export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;

export const completeRoutineSchema = z.object({
  run_on: z.string().datetime().optional(),
  completed_steps: z.number().int().min(0).optional(),
});

export type CompleteRoutineInput = z.infer<typeof completeRoutineSchema>;
