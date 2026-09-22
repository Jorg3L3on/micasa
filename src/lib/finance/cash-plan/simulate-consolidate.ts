export type ConsolidateSimulation = {
  principalCents: number;
  financedCents: number;
  feeCents: number;
  paymentCents: number;
  interestCents: number;
  weightedApr: number | null;
  worseRate: boolean;
};

const monthlyPayment = (principalCents: number, aprAnnual: number, termMonths: number): number => {
  if (termMonths <= 0) return principalCents;
  if (principalCents <= 0) return 0;
  const monthlyRate = aprAnnual / 12;
  if (monthlyRate <= 0) return Math.ceil(principalCents / termMonths);
  const factor = (1 + monthlyRate) ** termMonths;
  return Math.round((principalCents * monthlyRate * factor) / (factor - 1));
};

/**
 * Fee is added to the balance you finance.
 * `worseRate` is true when the new APR does not beat the balance-weighted APR.
 */
export const simulateConsolidate = (input: {
  balancesCents: number[];
  aprs: Array<number | null>;
  aprAnnual: number;
  termMonths: number;
  feePct: number;
}): ConsolidateSimulation | null => {
  const { balancesCents, aprs, aprAnnual, termMonths, feePct } = input;
  if (!Number.isFinite(aprAnnual) || aprAnnual <= 0) return null;
  if (!Number.isInteger(termMonths) || termMonths < 1) return null;
  if (!Number.isFinite(feePct) || feePct < 0 || feePct >= 1) return null;

  const principalCents = balancesCents.reduce((sum, balance) => sum + Math.max(0, balance), 0);
  if (principalCents <= 0 || balancesCents.filter((balance) => balance > 0).length < 2) return null;

  let weightedNumerator = 0;
  let weightedDenominator = 0;
  balancesCents.forEach((balance, index) => {
    const apr = aprs[index];
    if (balance > 0 && apr != null && apr > 0) {
      weightedNumerator += balance * apr;
      weightedDenominator += balance;
    }
  });
  const weightedApr = weightedDenominator > 0 ? weightedNumerator / weightedDenominator : null;
  const feeCents = Math.round(principalCents * feePct);
  const financedCents = principalCents + feeCents;
  const paymentCents = monthlyPayment(financedCents, aprAnnual, termMonths);
  const interestCents = Math.max(0, paymentCents * termMonths - financedCents);

  return {
    principalCents,
    financedCents,
    feeCents,
    paymentCents,
    interestCents,
    weightedApr,
    worseRate: weightedApr != null && aprAnnual >= weightedApr - 1e-9,
  };
};
