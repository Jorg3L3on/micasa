/** % del ingreso de la quincena ya comprometido (pagado + pendiente [+ nómina] [+ presupuesto]). */
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
