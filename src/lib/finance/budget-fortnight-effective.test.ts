import { describe, expect, it } from 'vitest';
import {
  applyFortnightAdjustment,
  remainingReserve,
  splitTotalAcrossAllocations,
} from './budget-fortnight-effective';

const template = [
  { wallet_id: null, category_id: 5, budgeted: 2600 },
  { wallet_id: 2, category_id: 6, budgeted: 800 },
];

describe('applyFortnightAdjustment', () => {
  it('keeps the template share when there is no adjustment', () => {
    expect(applyFortnightAdjustment(template, null)).toEqual([2600, 800]);
  });

  it('zeroes every category on PAUSE', () => {
    expect(
      applyFortnightAdjustment(template, { kind: 'PAUSE', allocations: [] }),
    ).toEqual([0, 0]);
  });

  it('uses the adjusted amounts on AMOUNTS', () => {
    expect(
      applyFortnightAdjustment(template, {
        kind: 'AMOUNTS',
        allocations: [
          { wallet_id: null, category_id: 5, amount: 1000 },
          { wallet_id: 2, category_id: 6, amount: 0 },
        ],
      }),
    ).toEqual([1000, 0]);
  });

  it('falls back to the template for a category added after the adjustment', () => {
    expect(
      applyFortnightAdjustment(template, {
        kind: 'AMOUNTS',
        allocations: [{ wallet_id: null, category_id: 5, amount: 1000 }],
      }),
    ).toEqual([1000, 800]);
  });

  it('does not match a wallet-specific key against an any-wallet allocation', () => {
    expect(
      applyFortnightAdjustment(template, {
        kind: 'AMOUNTS',
        allocations: [{ wallet_id: 9, category_id: 5, amount: 1 }],
      }),
    ).toEqual([2600, 800]);
  });
});

describe('splitTotalAcrossAllocations', () => {
  it('splits in the template proportions', () => {
    expect(splitTotalAcrossAllocations(1700, [2600, 800])).toEqual([1300, 400]);
  });

  it('adds up to the total exactly in cents', () => {
    const parts = splitTotalAcrossAllocations(100, [1, 1, 1]);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(Math.round(parts.reduce((s, p) => s + p, 0) * 100)).toBe(10000);
  });

  it('gives zeros for a zero total and handles one category', () => {
    expect(splitTotalAcrossAllocations(0, [2600, 800])).toEqual([0, 0]);
    expect(splitTotalAcrossAllocations(1234.56, [2600])).toEqual([1234.56]);
    expect(splitTotalAcrossAllocations(50, [])).toEqual([]);
  });
});

describe('remainingReserve', () => {
  it('does not let overspend in one category shrink another', () => {
    expect(
      remainingReserve([
        { budgeted: 500, spent: 800 },
        { budgeted: 1000, spent: 0 },
      ]),
    ).toBe(1000);
  });
});
