import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE } from '@/schemas/auth.schema';

export const updateAccountSchema = z
  .object({
    name: z
      .string()
      .min(1, 'El nombre es requerido')
      .max(255, 'El nombre es muy largo')
      .optional(),
    currentPassword: z.string().optional().or(z.literal('')),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE)
      .optional()
      .or(z.literal('')),
    confirmPassword: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      const hasNew =
        data.newPassword != null && String(data.newPassword).trim().length > 0;
      if (!hasNew) return true;
      return data.newPassword === data.confirmPassword;
    },
    { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] }
  )
  .refine(
    (data) => {
      const hasNew =
        data.newPassword != null && String(data.newPassword).trim().length > 0;
      if (!hasNew) return true;
      return (
        data.currentPassword != null &&
        String(data.currentPassword).trim().length > 0
      );
    },
    {
      message: 'La contraseña actual es requerida',
      path: ['currentPassword'],
    }
  );

export type UpdateAccountValues = z.infer<typeof updateAccountSchema>;
