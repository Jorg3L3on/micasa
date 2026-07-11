import { z } from 'zod';

export const GENERIC_REGISTER_ERROR_MESSAGE =
  'No se pudo crear la cuenta con estos datos. Si ya tienes cuenta, inicia sesión.';

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'El nombre es requerido')
      .max(255, 'El nombre es muy largo'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.string().email('Correo electrónico inválido')),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const normalizeRegisterEmail = (email: string): string =>
  email.trim().toLowerCase();
