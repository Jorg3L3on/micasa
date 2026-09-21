/** % del ingreso de la quincena ya comprometido (pagado + pendiente [+ nómina] [+ presupuesto restante]). */
export const getFortnightIncomeCommittedPercent = (
  periodIncome: number,
  paid: number,
  pending: number,
): number => {
  if (periodIncome <= 0) return 0;
  return Math.round(((paid + pending) / periodIncome) * 100);
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

/** Semantic tone for how much of income is already committed. */
export const getIncomeCommitmentTone = (
  percentCommitted: number,
): 'ok' | 'warning' | 'danger' => {
  const pct = clampPercent(percentCommitted);
  if (pct >= 90) return 'danger';
  if (pct >= 75) return 'warning';
  return 'ok';
};

export type FortnightCommitmentBar = {
  /** Anchos de la barra (suman 100). Pagado / (pendiente + nómina) / presupuesto / libre. */
  paidPercent: number;
  pendingPercent: number;
  budgetPercent: number;
  freePercent: number;
  /** Posición (%) de la línea del ingreso; null si no hay sobrecompromiso. */
  incomeMarkerPercent: number | null;
  /** % total comprometido (etiqueta / tono), puede superar 100. */
  totalCommittedPercent: number;
  tone: 'ok' | 'warning' | 'danger';
};

/**
 * Segmentos de la barra de compromiso: pagado (emerald) → pendiente (amber) →
 * presupuesto (violet) → libre (muted).
 *
 * Si el compromiso supera el ingreso, la barra se escala al total (no se recorta)
 * y `incomeMarkerPercent` marca dónde termina el ingreso.
 */
export const getFortnightCommitmentBar = (
  periodIncome: number,
  paidAmount: number,
  cashCommitted: number,
  budgetRemaining: number,
): FortnightCommitmentBar => {
  const paid = Math.max(0, paidAmount);
  const cash = Math.max(0, cashCommitted);
  const budget = Math.max(0, budgetRemaining);
  const pendingCash = Math.max(0, cash - paid);
  const totalCommitted = cash + budget;
  const totalCommittedPercent =
    periodIncome <= 0
      ? 0
      : Math.round((totalCommitted / periodIncome) * 100);
  const tone = getIncomeCommitmentTone(totalCommittedPercent);

  if (periodIncome <= 0) {
    return {
      paidPercent: 0,
      pendingPercent: 0,
      budgetPercent: 0,
      freePercent: 0,
      incomeMarkerPercent: null,
      totalCommittedPercent: 0,
      tone,
    };
  }

  const scale = Math.max(1, totalCommitted / periodIncome);
  const toBarPercent = (amount: number) =>
    (amount / periodIncome / scale) * 100;

  return {
    paidPercent: toBarPercent(paid),
    pendingPercent: toBarPercent(pendingCash),
    budgetPercent: toBarPercent(budget),
    freePercent: toBarPercent(Math.max(0, periodIncome - totalCommitted)),
    incomeMarkerPercent: scale > 1 ? 100 / scale : null,
    totalCommittedPercent,
    tone,
  };
};
