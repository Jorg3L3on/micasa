import { describe, expect, it } from 'vitest';
import {
  parseWalletSelection,
  resolveSelectedWalletId,
  stepWalletSelection,
  walletsForTab,
} from './wallet-master-detail';

const list = [{ id: 4 }, { id: 9 }, { id: 2 }];

describe('parseWalletSelection', () => {
  it('accepts positive integers only', () => {
    expect(parseWalletSelection('12')).toBe(12);
    expect(parseWalletSelection('0')).toBeNull();
    expect(parseWalletSelection('-3')).toBeNull();
    expect(parseWalletSelection('1.5')).toBeNull();
    expect(parseWalletSelection('abc')).toBeNull();
    expect(parseWalletSelection(null)).toBeNull();
  });
});

describe('resolveSelectedWalletId', () => {
  it('keeps a requested wallet that is still listed', () => {
    expect(resolveSelectedWalletId(list, 9)).toBe(9);
  });
  it('falls back to the first wallet when filtered out or unset', () => {
    expect(resolveSelectedWalletId(list, 77)).toBe(4);
    expect(resolveSelectedWalletId(list, null)).toBe(4);
  });
  it('is null for an empty list', () => {
    expect(resolveSelectedWalletId([], 4)).toBeNull();
  });
});

describe('stepWalletSelection', () => {
  it('moves and clamps at the ends', () => {
    expect(stepWalletSelection(list, 4, 1)).toBe(9);
    expect(stepWalletSelection(list, 2, 1)).toBe(2);
    expect(stepWalletSelection(list, 4, -1)).toBe(4);
    expect(stepWalletSelection(list, null, 1)).toBe(9);
    expect(stepWalletSelection([], 1, 1)).toBeNull();
  });
});

describe('walletsForTab', () => {
  const sections = { funding: [1, 2], credit: [3] };
  it('returns one group or both in on-screen order', () => {
    expect(walletsForTab('funding', sections)).toEqual([1, 2]);
    expect(walletsForTab('credit', sections)).toEqual([3]);
    expect(walletsForTab('all', sections)).toEqual([1, 2, 3]);
  });
});
