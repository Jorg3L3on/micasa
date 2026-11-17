/**
 * One-quincena budget adjustments (MIC-I19).
 *
 * A budget template says how much each category gets; Panel prorates it per
 * quincena. A `BudgetFortnightAdjustment` replaces that share for one quincena
 * only. Every reader (Panel, report summary, Simular compra, Presupuestos)
 * goes through these pure helpers so the numbers cannot drift.
 */

export type BudgetAdjustmentKind = 'PAUSE' | 'AMOUNTS';

export type AllocationKey = {
  /** Null matches the category on every wallet. */
  wallet_id: number | null;
  category_id: number;
};

export type FortnightAdjustmentInput = {
  kind: BudgetAdjustmentKind;
  note?: string | null;
  allocations: Array<AllocationKey & { amount: number }>;
};

export const allocationKeyOf = (key: AllocationKey): string =>
  `${key.wallet_id ?? 'any'}:${key.category_id}`;

const toCents = (value: number): number => Math.round(value * 100);

/**
 * Effective amount per template allocation for one quincena.
 *
 * - No adjustment: the prorated template share, unchanged.
 * - PAUSE: zero for every category.
 * - AMOUNTS: the adjusted amount where one is stored; categories added to the
 *   template after the adjustment keep their template share.
 */
export function applyFortnightAdjustment(
  template: Array<AllocationKey & { budgeted: number }>,
  adjustment: FortnightAdjustmentInput | null,
): number[] {
  if (!adjustment) return template.map((row) => row.budgeted);
  if (adjustment.kind === 'PAUSE') return template.map(() => 0);
  const byKey = new Map(
    adjustment.allocations.map((row) => [allocationKeyOf(row), row.amount] as const),
  );
  return template.map((row) => byKey.get(allocationKeyOf(row)) ?? row.budgeted);
}

/**
 * Split a quincena total across the template's categories in the template's
 * proportions, in cents. The last category takes the rounding remainder so the
 * parts always add up to the total exactly.
 */
export function splitTotalAcrossAllocations(
  total: number,
  templateAmounts: number[],
): number[] {
  if (templateAmounts.length === 0) return [];
  const totalCents = toCents(Math.max(0, total));
  const weights = templateAmounts.map((amount) => Math.max(0, toCents(amount)));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const parts =
    weightSum > 0
      ? weights.map((w) => Math.floor((totalCents * w) / weightSum))
      : weights.map((_, index) =>
          index === 0 ? 0 : Math.floor(totalCents / weights.length),
        );
  const assigned = parts.reduce((sum, part) => sum + part, 0);
  parts[parts.length - 1] += totalCents - assigned;
  return parts.map((cents) => cents / 100);
}

/**
 * What a budget still reserves this quincena: the unspent part of each
 * category, never negative. Overspend in one category does not shrink the
 * reserve of another (it is already counted in Pagado).
 */
export function remainingReserve(
  rows: Array<{ budgeted: number; spent: number }>,
): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.budgeted - row.spent), 0);
}
