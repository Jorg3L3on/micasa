import { describe, expect, it } from 'vitest';
import {
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
});
