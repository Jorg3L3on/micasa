import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE } from '@/schemas/auth.schema';

export const adminSetTempPasswordSchema = z
  .object({
    temporaryPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE),
    confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((data) => data.temporaryPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type AdminSetTempPasswordValues = z.infer<
  typeof adminSetTempPasswordSchema
>;
