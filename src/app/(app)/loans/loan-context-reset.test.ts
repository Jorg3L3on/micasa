import { describe, expect, it } from 'vitest';
import {
  emptyLoanContextLists,
  isCurrentLoanContext,
} from './loan-context-reset';

describe('loan context reset', () => {
  it('clears loans, lenders, wallets, and income templates together', () => {
    expect(emptyLoanContextLists()).toEqual({
      loans: [],
      lenders: [],
      wallets: [],
      incomeTemplates: [],
    });
  });

  it('ignores a response captured for the previous context', () => {
    expect(isCurrentLoanContext('house:2', 'house:2')).toBe(true);
    expect(isCurrentLoanContext('user:1', 'house:2')).toBe(false);
  });
});