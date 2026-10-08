import { z } from 'zod';

export const GENERIC_REGISTER_ERROR_MESSAGE =
  'No se pudo crear la cuenta con estos datos. Si ya tienes cuenta, inicia sesión.';

/** Shared by signup, change password, and admin temporary passwords. */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MIN_LENGTH_MESSAGE = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre')
    .max(255, 'El nombre es muy largo'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email('Escribe un correo válido, por ejemplo nombre@ejemplo.com')),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH_MESSAGE)
    .max(128, 'La contraseña es muy larga'),
});

export type RegisterValues = z.infer<typeof registerSchema>;

export const normalizeRegisterEmail = (email: string): string =>
  email.trim().toLowerCase();
