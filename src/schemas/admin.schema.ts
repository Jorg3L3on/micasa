import { z } from 'zod';

export const adminSetTempPasswordSchema = z
  .object({
    temporaryPassword: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((data) => data.temporaryPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type AdminSetTempPasswordValues = z.infer<
  typeof adminSetTempPasswordSchema
>;
