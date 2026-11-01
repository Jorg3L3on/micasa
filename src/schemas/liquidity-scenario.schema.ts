import { z } from 'zod';
import { dateStringSchema } from '@/schemas/common.schema';

/** The API accepts up to three hypothetical items; the UI shows one. */
export const LIQUIDITY_SCENARIO_MAX_ITEMS = 3;
export const LIQUIDITY_SCENARIO_MAX_MONTHS = 48;

const amountSchema = z
  .number({ message: 'Escribe un monto.' })
  .positive('El monto debe ser mayor a $0.')
  .max(99999999.99, 'El monto es demasiado alto.');

const walletIdSchema = z
  .number({ message: 'Elige una billetera.' })
  .int('Elige una billetera.')
  .positive('Elige una billetera.');

export const liquidityScenarioPurchaseSchema = z.object({
  kind: z.literal('purchase'),
  amount: amountSchema,
  date: dateStringSchema,
  wallet_id: walletIdSchema,
});

export const liquidityScenarioInstalmentSchema = z.object({
  kind: z.literal('instalment'),
  amount: amountSchema,
  firstDate: dateStringSchema,
  months: z
    .number({ message: 'Indica cuántos meses.' })
    .int('Indica cuántos meses.')
    .min(1, 'Indica al menos 1 mes.')
    .max(
      LIQUIDITY_SCENARIO_MAX_MONTHS,
      `Indica como máximo ${LIQUIDITY_SCENARIO_MAX_MONTHS} meses.`,
    ),
  wallet_id: walletIdSchema,
});

export const liquidityScenarioItemSchema = z.discriminatedUnion('kind', [
  liquidityScenarioPurchaseSchema,
  liquidityScenarioInstalmentSchema,
]);

export const liquidityScenarioSchema = z
  .array(liquidityScenarioItemSchema)
  .min(1, 'La simulación está vacía.')
  .max(
    LIQUIDITY_SCENARIO_MAX_ITEMS,
    `Se pueden simular hasta ${LIQUIDITY_SCENARIO_MAX_ITEMS} movimientos a la vez.`,
  );

export type LiquidityScenarioItem = z.infer<typeof liquidityScenarioItemSchema>;

export type LiquidityScenarioField =
  | 'scenario'
  | 'kind'
  | 'amount'
  | 'date'
  | 'firstDate'
  | 'months'
  | 'wallet_id';

/** 400 body for a scenario the UI can pin to one field of one item. */
export type LiquidityScenarioError = {
  error: string;
  field: LiquidityScenarioField;
  index: number | null;
};

const scenarioFields = new Set<string>([
  'kind',
  'amount',
  'date',
  'firstDate',
  'months',
  'wallet_id',
]);

/**
 * Parses the `scenario` query parameter (JSON array) and checks that every
 * date falls inside [today, until]. Wallet ownership is checked by the service.
 */
export const parseLiquidityScenarioParam = (
  raw: string,
  window: { today: string; until: string },
):
  | { ok: true; items: LiquidityScenarioItem[] }
  | { ok: false; error: LiquidityScenarioError } => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: {
        error: 'Parámetro "scenario" inválido (usa un arreglo JSON).',
        field: 'scenario',
        index: null,
      },
    };
  }

  const parsed = liquidityScenarioSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const [index, field] = first?.path ?? [];
    const pinned = typeof index === 'number' && typeof field === 'string' && scenarioFields.has(field);
    return {
      ok: false,
      error: {
        error: first?.message ?? 'Simulación inválida.',
        field: pinned ? (field as LiquidityScenarioField) : 'scenario',
        index: typeof index === 'number' ? index : null,
      },
    };
  }

  for (const [index, item] of parsed.data.entries()) {
    const field = item.kind === 'purchase' ? 'date' : 'firstDate';
    const date = item.kind === 'purchase' ? item.date : item.firstDate;
    if (date < window.today) {
      return {
        ok: false,
        error: { error: 'La fecha no puede ser anterior a hoy.', field, index },
      };
    }
    if (date > window.until) {
      return {
        ok: false,
        error: {
          error: 'La fecha queda fuera del horizonte de la proyección.',
          field,
          index,
        },
      };
    }
  }

  return { ok: true, items: parsed.data };
};
