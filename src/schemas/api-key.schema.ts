import { z } from 'zod';

export const apiKeyScopesSchema = z
  .array(z.enum(['read', 'write']))
  .min(1, 'Selecciona al menos un permiso')
  .refine((scopes) => scopes.includes('read'), {
    message: 'El permiso de lectura es obligatorio',
  });

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(60, 'Máximo 60 caracteres'),
  scopes: apiKeyScopesSchema,
  expires_in_days: z
    .number()
    .int()
    .min(1, 'Mínimo 1 día')
    .max(365, 'Máximo 365 días')
    .nullable()
    .optional()
    .describe('Días hasta expirar; null u omitido = sin expiración.'),
});

export const renameApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(60, 'Máximo 60 caracteres'),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type RenameApiKeyInput = z.infer<typeof renameApiKeySchema>;
