import { describe, expect, it } from 'vitest';
import { getFortnightIncomeCommittedPercent } from './fortnight-income-commitment';

describe('FortnightIncomeGauge data', () => {
  it('computes commitment percent for gauge label', () => {
    expect(getFortnightIncomeCommittedPercent(10000, 3000, 2000)).toBe(50);
  });
});
