import { describe, expect, it } from 'vitest';
import { getFortnightIncomeCommittedPercent } from './fortnight-income-commitment';

describe('getFortnightIncomeCommittedPercent', () => {
  it('returns committed share of period income', () => {
    expect(getFortnightIncomeCommittedPercent(21_400, 10_000, 7_405)).toBe(81);
  });

  it('returns 0 when income is zero', () => {
    expect(getFortnightIncomeCommittedPercent(0, 100, 50)).toBe(0);
  });

  it('can exceed 100 when committed surpasses income', () => {
    expect(getFortnightIncomeCommittedPercent(1_000, 800, 500)).toBe(130);
  });

  it('includes presupuesto when folded into the pending argument', () => {
    // pagado 10_000 + pendiente 5_000 + presupuesto 6_000 = 21_000 → 100%
    expect(getFortnightIncomeCommittedPercent(21_000, 10_000, 5_000 + 6_000)).toBe(
      100,
    );
  });
});
