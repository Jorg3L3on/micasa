/** User-entered percent and months. Empty fields do not simulate. */
export const parseLoanSimFields = (
  ratePercent: string,
  termMonths: string,
  feePercent: string,
): { aprAnnual: number; termMonths: number; feePct: number } | null => {
  if (ratePercent.trim() === '' || termMonths.trim() === '' || feePercent.trim() === '') {
    return null;
  }
  const apr = Number(ratePercent.replace(',', '.'));
  const term = Number(termMonths);
  const fee = Number(feePercent.replace(',', '.'));
  if (!Number.isFinite(apr) || apr <= 0 || apr >= 1000) return null;
  if (!Number.isInteger(term) || term < 1 || term > 360) return null;
  if (!Number.isFinite(fee) || fee < 0 || fee >= 100) return null;
  return {
    aprAnnual: apr / 100,
    termMonths: term,
    feePct: fee / 100,
  };
};
