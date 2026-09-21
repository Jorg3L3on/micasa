import { describe, expect, it } from 'vitest';
import {
  getFortnightCommitmentBar,
  getFortnightIncomeCommittedPercent,
  getIncomeCommitmentTone,
} from './fortnight-income-commitment';

describe('FortnightIncomeGauge data', () => {
  it('computes commitment percent for gauge label', () => {
    expect(getFortnightIncomeCommittedPercent(10000, 3000, 2000)).toBe(50);
  });

  it('maps commitment percent to semantic tone', () => {
    expect(getIncomeCommitmentTone(0)).toBe('ok');
    expect(getIncomeCommitmentTone(74)).toBe('ok');
    expect(getIncomeCommitmentTone(75)).toBe('warning');
    expect(getIncomeCommitmentTone(89)).toBe('warning');
    expect(getIncomeCommitmentTone(90)).toBe('danger');
    expect(getIncomeCommitmentTone(98)).toBe('danger');
  });

  it('splits paid, pending, budget, and free percents without clipping', () => {
    // $21k income, $10.5k cash, $3.15k budget remaining → 50% / 15% / 35%
    const bar = getFortnightCommitmentBar(21_000, 10_500, 10_500, 3_150);
    expect(bar.paidPercent).toBeCloseTo(50);
    expect(bar.pendingPercent).toBeCloseTo(0);
    expect(bar.budgetPercent).toBeCloseTo(15);
    expect(bar.freePercent).toBeCloseTo(35);
    expect(bar.incomeMarkerPercent).toBeNull();
    expect(bar.totalCommittedPercent).toBe(65);
    expect(bar.tone).toBe('ok');
  });

  it('scales the bar and marks income when commitment exceeds 100%', () => {
    // $21k income, $0 paid, $22,861.77 cash, $2,600 budget → 121%
    const bar = getFortnightCommitmentBar(21_000, 0, 22_861.77, 2_600);
    expect(bar.totalCommittedPercent).toBe(121);
    expect(bar.tone).toBe('danger');
    expect(bar.freePercent).toBe(0);
    expect(bar.incomeMarkerPercent).toBeCloseTo(100 / (25_461.77 / 21_000));
    expect(bar.paidPercent + bar.pendingPercent + bar.budgetPercent).toBeCloseTo(
      100,
    );
    expect(bar.pendingPercent).toBeCloseTo((22_861.77 / 25_461.77) * 100);
    expect(bar.budgetPercent).toBeCloseTo((2_600 / 25_461.77) * 100);
  });

  it('returns empty percents when income is zero', () => {
    const bar = getFortnightCommitmentBar(0, 100, 200, 50);
    expect(bar.paidPercent).toBe(0);
    expect(bar.pendingPercent).toBe(0);
    expect(bar.budgetPercent).toBe(0);
    expect(bar.freePercent).toBe(0);
    expect(bar.incomeMarkerPercent).toBeNull();
    expect(bar.totalCommittedPercent).toBe(0);
  });
});
