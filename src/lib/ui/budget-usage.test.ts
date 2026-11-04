import { describe, expect, it } from 'vitest';
import { getBudgetUsedPercent, getBudgetUsedTone } from './budget-usage';

describe('getBudgetUsedPercent', () => {
  it('rounds spent over total', () => {
    expect(getBudgetUsedPercent({ totalBudget: 3000, spent: 1000 })).toBe(33);
  });

  it('is 0 without a budget', () => {
    expect(getBudgetUsedPercent({ totalBudget: 0, spent: 250 })).toBe(0);
  });
});

describe('getBudgetUsedTone', () => {
  it('goes success, pending from 85, expense over 100', () => {
    expect(getBudgetUsedTone(84)).toBe('success');
    expect(getBudgetUsedTone(85)).toBe('pending');
    expect(getBudgetUsedTone(100)).toBe('pending');
    expect(getBudgetUsedTone(101)).toBe('expense');
  });
});
