import { z } from 'zod';
import { isValidCalendarDateString } from '@/lib/calendar-dates';

/**
 * Shared input schemas for MCP tools. Tool files import these instead of
 * declaring their own copies.
 */

export const dateYmd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato requerido: YYYY-MM-DD')
  .refine(isValidCalendarDateString, 'La fecha no existe en el calendario')
  .describe('Fecha de calendario YYYY-MM-DD (Ciudad de México).');

export const ownerArgs = {
  owner_type: z
    .enum(['user', 'house'])
    .describe(
      'Contexto financiero: "user" (finanzas personales) o "house" (casa compartida). Los valores válidos salen de list_houses.',
    ),
  owner_id: z
    .number()
    .int()
    .positive()
    .describe('Id del usuario (owner_type=user) o de la casa (owner_type=house), según list_houses.'),
};

export type OwnerArgs = {
  owner_type: 'user' | 'house';
  owner_id: number;
};

const OWNER_ALIASES = [
  ['ownerType', 'owner_type'],
  ['ownerId', 'owner_id'],
] as const;

/**
 * v2 clients send camelCase `ownerType` / `ownerId`. Accepted for one version
 * (see docs/mcp-connector.md): renamed before strict validation so the alias
 * never shows up in `tools/list`. The snake_case key wins when both arrive.
 */
export const normalizeOwnerAliases = (input: unknown): unknown => {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }
  const record = { ...(input as Record<string, unknown>) };
  for (const [alias, canonical] of OWNER_ALIASES) {
    if (!(alias in record)) continue;
    if (!(canonical in record)) record[canonical] = record[alias];
    delete record[alias];
  }
  return record;
};

export const walletRef = {
  wallet_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Id de la billetera (de list_wallets). Tiene prioridad sobre wallet_name.'),
  wallet_name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nombre exacto de la billetera, sin distinguir mayúsculas. Usa wallet_id si el nombre se repite.'),
};

export const categoryRef = {
  category_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Id de la categoría (de list_categories). Tiene prioridad sobre category_name.'),
  category_name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nombre exacto de la categoría, sin distinguir mayúsculas.'),
};

export const pagination = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Máximo de filas a devolver (1-200, por defecto 50).'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Filas a saltar para paginar (por defecto 0). Usa total_count de la respuesta.'),
};

export const confirm = z
  .literal(true)
  .describe(
    'Debe ser true: confirma que el usuario aprobó esta operación, que elimina datos o sobreescribe saldos.',
  );
