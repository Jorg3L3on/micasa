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

/** Explained once in the server instructions; short here because every tool repeats it. */
export const ownerArgs = {
  owner_type: z.enum(['user', 'house']).describe('Contexto, de list_houses.'),
  owner_id: z.number().int().positive().describe('Id del contexto, de list_houses.'),
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
  wallet_id: z.number().int().positive().optional().describe('Billetera, de list_wallets.'),
  wallet_name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nombre de la billetera (alternativa a wallet_id).'),
};

export const categoryRef = {
  category_id: z.number().int().positive().optional().describe('Categoría, de list_categories.'),
  category_name: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Nombre de la categoría (alternativa a category_id).'),
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

export const period = z.enum(['FIRST', 'SECOND']).describe('Quincena del mes.');

export const year = z.number().int().min(2000).max(2100).describe('Año.');

export const month = z.number().int().min(1).max(12).describe('Mes.');

/** Fortnight by id or by calendar period (resolved with `resolveFortnightRef`). */
export const fortnightRef = {
  fortnight_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Quincena; alternativa a year + month + period.'),
  year: year.optional(),
  month: month.optional(),
  period: period.optional(),
};
