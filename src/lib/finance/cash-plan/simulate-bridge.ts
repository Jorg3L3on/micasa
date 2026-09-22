export type BridgeSimulation = {
  amountCents: number;
  proceedsCents: number;
  feeCents: number;
  paymentCents: number;
  interestCents: number;
  totalCostCents: number;
};

const monthlyPayment = (principalCents: number, aprAnnual: number, termMonths: number): number => {
  if (termMonths <= 0) return principalCents;
  if (principalCents <= 0) return 0;
  const monthlyRate = aprAnnual / 12;
  if (monthlyRate <= 0) return Math.ceil(principalCents / termMonths);
  const factor = (1 + monthlyRate) ** termMonths;
  return Math.round((principalCents * monthlyRate * factor) / (factor - 1));
};

/** Returns null until amount, APR, term, and fee are all valid. No numeric defaults. */
export const simulateBridge = (input: {
  amountCents: number;
  aprAnnual: number;
  termMonths: number;
  feePct: number;
}): BridgeSimulation | null => {
  const { amountCents, aprAnnual, termMonths, feePct } = input;
  if (!Number.isInteger(amountCents) || amountCents <= 0) return null;
  if (!Number.isFinite(aprAnnual) || aprAnnual <= 0) return null;
  if (!Number.isInteger(termMonths) || termMonths < 1) return null;
  if (!Number.isFinite(feePct) || feePct < 0 || feePct >= 1) return null;

  const feeCents = Math.round(amountCents * feePct);
  const proceedsCents = amountCents - feeCents;
  if (proceedsCents <= 0) return null;
  const paymentCents = monthlyPayment(amountCents, aprAnnual, termMonths);
  const interestCents = Math.max(0, paymentCents * termMonths - amountCents);
  return {
    amountCents,
    proceedsCents,
    feeCents,
    paymentCents,
    interestCents,
    totalCostCents: interestCents + feeCents,
  };
};
