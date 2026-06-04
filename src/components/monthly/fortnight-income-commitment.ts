/** % del ingreso de la quincena ya comprometido (pagado + pendiente). */
export const getFortnightIncomeCommittedPercent = (
  periodIncome: number,
  paid: number,
  pending: number,
): number => {
  if (periodIncome <= 0) return 0;
  return Math.round(((paid + pending) / periodIncome) * 100);
};
