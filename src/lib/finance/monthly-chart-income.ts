/**
 * Aggregation rules for `/api/wallets/liquidity/monthly-summary` — aligned with panel totals:
 * - Expenses / “salió”: debt outflows only (loan payments + credit-card payments).
 *   Recurring templates (rent, subscriptions) are excluded.
 * - Income: per fortnight, `source === '__OVERRIDE__'` replaces other rows (same as reports).
 */

export const INCOME_OVERRIDE_SOURCE = '__OVERRIDE__';

export const effectiveFortnightIncome = (
  rows: Array<{ amount: number; source: string | null }>,
): number => {
  const override = rows.find((r) => r.source === INCOME_OVERRIDE_SOURCE);
  if (override) return override.amount;
  return rows
    .filter((r) => r.source !== INCOME_OVERRIDE_SOURCE)
    .reduce((s, r) => s + r.amount, 0);
};
