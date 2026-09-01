import { describe, expect, it } from 'vitest';
import {
  getFortnightIncomeCommittedPercent,
  getFortnightIncomeGaugeSegments,
  getIncomeCommitmentTone,
} from './fortnight-income-commitment';
import {
  gaugeJoinInsetDeg,
  insetArcJoins,
} from './fortnight-income-gauge-geometry';

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

describe('FortnightIncomeGauge joins', () => {
  it('insets interior joins so round caps do not overlap', () => {
    const inset = gaugeJoinInsetDeg();
    const cash = insetArcJoins(180, 36, false, true, inset);
    const budget = insetArcJoins(36, 14, true, true, inset);
    const free = insetArcJoins(14, 0, true, false, inset);

    expect(cash).not.toBeNull();
    expect(budget).not.toBeNull();
    expect(free).not.toBeNull();
    expect(cash!.endDeg).toBeCloseTo(36 + inset);
    expect(budget!.startDeg).toBeCloseTo(36 - inset);
    expect(budget!.endDeg).toBeCloseTo(14 + inset);
    expect(free!.startDeg).toBeCloseTo(14 - inset);
    expect(free!.endDeg).toBe(0);
  });

  it('keeps a tiny segment drawable by reducing inset', () => {
    const arc = insetArcJoins(20, 16, true, true, 8);
    expect(arc).not.toBeNull();
    expect(arc!.startDeg).toBeGreaterThan(arc!.endDeg);
  });
});
