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

  it('includes presupuesto restante when folded into the pending argument', () => {
    // pagado 1_200 + restante 1_800 = sobre $3,000 → 14% de 21_000
    expect(
      getFortnightIncomeCommittedPercent(21_000, 1_200, 1_800),
    ).toBe(14);
  });
});
