import type { CreditCardStatementWindow } from '@/lib/finance/credit-card-statement.service';

/**
 * UTC date-only strings align with {@link resolveCreditCardStatementWindow}
 * and tarjeta statement fields (`statement_due_date`, etc.).
 */
export const toUtcDateOnlyString = (date: Date) =>
  date.toISOString().split('T')[0];

/** -1 if a < b, 0 if equal, 1 if a > b (for `YYYY-MM-DD`). */
export const compareUtcDateOnly = (a: string, b: string): number => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

export const addDaysUtc = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

/** Move `asOf` past the current cycle so the next iteration resolves the siguiente periodo de corte. */
export const advanceStatementCursor = (window: CreditCardStatementWindow): Date =>
  addDaysUtc(window.currentCycleEnd, 1);

/** Hard cap per grupo corte/vencimiento to avoid infinite loops on bad data. */
export const LIQUIDITY_MAX_CYCLES_PER_CARD_GROUP = 48;

export const DEFAULT_PROJECTION_HORIZON_DAYS = 180;

export const LIQUIDITY_PROJECTION_ASSUMPTIONS_ES: readonly string[] = [
  'Las fechas de estado usan el mismo calendario UTC que el motor de cortes y vencimientos.',
  'Cada periodo futuro solo suma cargos ya registrados y pagos a estado ya aplicados en la app; no se inventan compras futuras.',
  'El efectivo y débito son una foto de saldos actuales; no entran ingresos futuros ni otros gastos no ligados a tarjetas en esta proyección.',
];
