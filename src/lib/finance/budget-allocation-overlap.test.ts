import { describe, expect, it } from 'vitest';
import { allocationOverlapMessage } from './budget-allocation-overlap';

describe('allocationOverlapMessage', () => {
  it('allows the same category on two specific wallets', () => {
    expect(
      allocationOverlapMessage([
        { wallet_id: 1, category_id: 10 },
        { wallet_id: 2, category_id: 10 },
      ]),
    ).toBeNull();
  });

  it('rejects the same category twice with Cualquier cartera', () => {
    expect(
      allocationOverlapMessage([
        { wallet_id: null, category_id: 10 },
        { wallet_id: null, category_id: 10 },
      ]),
    ).toMatch(/dos veces/);
  });

  it('rejects Cualquier cartera combined with a specific wallet on the same category', () => {
    expect(
      allocationOverlapMessage([
        { wallet_id: null, category_id: 10 },
        { wallet_id: 4, category_id: 10 },
      ]),
    ).toMatch(/cartera específica/);
  });

  it('rejects a child allocation when the parent is Cualquier cartera', () => {
    const parents = new Map<number, number | null>([
      [10, null],
      [11, 10],
    ]);
    expect(
      allocationOverlapMessage(
        [
          { wallet_id: null, category_id: 10 },
          { wallet_id: 2, category_id: 11 },
        ],
        parents,
      ),
    ).toMatch(/subcategor/);
  });

  it('rejects Cualquier cartera on a child when the parent is also allocated', () => {
    const parents = new Map<number, number | null>([
      [10, null],
      [11, 10],
    ]);
    expect(
      allocationOverlapMessage(
        [
          { wallet_id: 2, category_id: 10 },
          { wallet_id: null, category_id: 11 },
        ],
        parents,
      ),
    ).toMatch(/subcategor/);
  });

  it('still allows a parent and child when both name a wallet', () => {
    const parents = new Map<number, number | null>([
      [10, null],
      [11, 10],
    ]);
    expect(
      allocationOverlapMessage(
        [
          { wallet_id: 2, category_id: 10 },
          { wallet_id: 2, category_id: 11 },
        ],
        parents,
      ),
    ).toBeNull();
  });
});
