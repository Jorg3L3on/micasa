/** % del ingreso de la quincena ya comprometido (pagado + pendiente [+ nómina] [+ presupuesto restante]). */
export const getFortnightIncomeCommittedPercent = (
  periodIncome: number,
  paid: number,
  pending: number,
): number => {
  if (periodIncome <= 0) return 0;
  return Math.round(((paid + pending) / periodIncome) * 100);
};

export type FortnightIncomeGaugeSegments = {
  /** Fracción del arco: pagado + pendiente + nómina. */
  cashRatio: number;
  /** Fracción del arco: presupuesto restante. */
  budgetRatio: number;
  /** Fracción del arco aún libre. */
  freeRatio: number;
  /** % total comprometido (etiqueta / tono), puede superar 100. */
  totalCommittedPercent: number;
};

/**
 * Segmentos del gauge: efectivo → presupuesto (violet) → libre (sky).
 * Si efectivo + presupuesto > 100 %, se recorta el presupuesto en pantalla.
 */
export const getFortnightIncomeGaugeSegments = (
  periodIncome: number,
  cashCommitted: number,
  budgetRemaining: number,
): FortnightIncomeGaugeSegments => {
  if (periodIncome <= 0) {
    return {
      cashRatio: 0,
      budgetRatio: 0,
      freeRatio: 0,
      totalCommittedPercent: 0,
    };
  }

  let cashRatio = Math.max(0, cashCommitted / periodIncome);
  let budgetRatio = Math.max(0, budgetRemaining / periodIncome);
  if (cashRatio + budgetRatio > 1) {
    if (cashRatio >= 1) {
      cashRatio = 1;
      budgetRatio = 0;
    } else {
      budgetRatio = 1 - cashRatio;
    }
  }
  const freeRatio = Math.max(0, 1 - cashRatio - budgetRatio);

  return {
    cashRatio,
    budgetRatio,
    freeRatio,
    totalCommittedPercent: Math.round(
      ((cashCommitted + budgetRemaining) / periodIncome) * 100,
    ),
  };
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
