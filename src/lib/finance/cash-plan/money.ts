/** Integer cents. Ranking never uses binary float money. */

export const toCents = (pesos: number): number => {
  if (!Number.isFinite(pesos)) return 0;
  return Math.round(pesos * 100);
};

export const fromCents = (cents: number): number => {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** $1. A smaller hole is treated as a balanced period. */
export const BALANCED_EPS_CENTS = 100;

export const formatPlanMoney = (cents: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(fromCents(cents));
