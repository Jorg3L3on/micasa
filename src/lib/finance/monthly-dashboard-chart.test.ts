import { describe, expect, it } from 'vitest';
import { effectiveFortnightIncome, INCOME_OVERRIDE_SOURCE } from './monthly-dashboard-chart';

describe('effectiveFortnightIncome', () => {
  it('sums regular rows when no override', () => {
    expect(
      effectiveFortnightIncome([
        { amount: 100, source: 'job' },
        { amount: 50, source: 'extra' },
      ]),
    ).toBe(150);
  });

  it('uses only override amount when present', () => {
    expect(
      effectiveFortnightIncome([
        { amount: 999, source: INCOME_OVERRIDE_SOURCE },
        { amount: 100, source: 'job' },
      ]),
    ).toBe(999);
  });

  it('ignores __OVERRIDE__ rows when summing regular', () => {
    expect(
      effectiveFortnightIncome([
        { amount: 100, source: 'job' },
        { amount: 200, source: null },
      ]),
    ).toBe(300);
  });
});
