import { describe, expect, it } from 'vitest';
import {
  getFortnightIncomeCommittedPercent,
  getFortnightIncomeGaugeSegments,
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

  it('splits cash, budget, and free ratios for the gauge arc', () => {
    // $21k income, $10.5k cash, $3.15k budget remaining → 50% / 15% / 35%
    const segments = getFortnightIncomeGaugeSegments(21_000, 10_500, 3_150);
    expect(segments.cashRatio).toBeCloseTo(0.5);
    expect(segments.budgetRatio).toBeCloseTo(0.15);
    expect(segments.freeRatio).toBeCloseTo(0.35);
    expect(segments.totalCommittedPercent).toBe(65);
  });

  it('clips budget segment when cash already fills the arc', () => {
    const segments = getFortnightIncomeGaugeSegments(1_000, 1_200, 500);
    expect(segments.cashRatio).toBe(1);
    expect(segments.budgetRatio).toBe(0);
    expect(segments.freeRatio).toBe(0);
    expect(segments.totalCommittedPercent).toBe(170);
  });
});
